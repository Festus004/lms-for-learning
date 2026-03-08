// lms-backend/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve the generated PDFs so they can be downloaded via a link
app.use('/static', express.static(path.join(__dirname, 'generated_certificates')));

// Configuration from .env
const PORT = process.env.PORT || 3000;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || 'LMS FOR LEARNING <no-reply@localhost>';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const CERT_DIR = path.join(__dirname, 'generated_certificates');
const CERTS_DB = path.join(__dirname, 'certs.json');

// Ensure the directory for PDFs exists
fs.ensureDirSync(CERT_DIR);
if (!fs.existsSync(CERTS_DB)) fs.writeJsonSync(CERTS_DB, {});

// Setup Email Transporter
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    }
});

// Helper functions for JSON Database
function loadCerts() {
    try { return fs.readJsonSync(CERTS_DB); } catch (e) { return {}; }
}
function saveCerts(data) {
    fs.writeJsonSync(CERTS_DB, data, { spaces: 2 });
}

// PDF Generation Logic
async function generateCertificatePDF({ id, name, course, date }) {
    const pdfPath = path.join(CERT_DIR, `${id}.pdf`);
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        // Decorative Border
        doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(10).stroke('#1a73e8');
        doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).lineWidth(2).stroke('#1d4ed8');

        // Content
        doc.moveDown(4);
        doc.font('Times-Bold').fontSize(40).fillColor('#1d4ed8').text('CERTIFICATE OF COMPLETION', { align: 'center' });
        
        doc.moveDown(1);
        doc.font('Helvetica').fontSize(18).fillColor('#333').text('This is to certify that', { align: 'center' });
        
        doc.moveDown(1);
        doc.font('Times-Bold').fontSize(35).fillColor('#000').text(name, { align: 'center' });
        
        doc.moveDown(1);
        doc.font('Helvetica').fontSize(18).fillColor('#333').text('has successfully completed the course', { align: 'center' });
        
        doc.moveDown(1);
        doc.font('Helvetica-Bold').fontSize(25).fillColor('#1d4ed8').text(course, { align: 'center' });

        doc.moveDown(2);
        doc.font('Helvetica').fontSize(12).fillColor('#666').text(`Issued on: ${date}`, { align: 'center' });
        doc.text(`Certificate ID: ${id}`, { align: 'center' });

        doc.end();
        stream.on('finish', () => resolve(pdfPath));
        stream.on('error', reject);
    });
}

// --- API ROUTES ---

// 1. Generate & Email Certificate
app.post('/api/send-certificate', async (req, res) => {
    try {
        const { name, email, course } = req.body;
        if (!name || !email || !course) return res.status(400).json({ error: 'Missing details' });

        const id = 'LMS-' + Math.floor(Math.random() * 900000 + 100000);
        const date = new Date().toLocaleDateString();

        const pdfPath = await generateCertificatePDF({ id, name, course, date });

        const certs = loadCerts();
        certs[id] = { id, name, email, course, date, pdfPath: `${id}.pdf` };
        saveCerts(certs);

        const mailOptions = {
            from: FROM_EMAIL,
            to: email,
            subject: `Course Certificate: ${course}`,
            html: `<h3>Congratulations ${name}!</h3><p>Your certificate for <b>${course}</b> is attached.</p>`,
            attachments: [{ filename: `Certificate-${id}.pdf`, path: pdfPath }]
        };

        await transporter.sendMail(mailOptions);
        res.json({ ok: true, id, message: "Certificate sent to email!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate/send certificate' });
    }
});

// 2. Verify Certificate
app.get('/api/verify/:id', (req, res) => {
    const certs = loadCerts();
    const cert = certs[req.params.id];
    if (!cert) return res.status(404).json({ valid: false });
    res.json({ valid: true, ...cert, downloadUrl: `${BASE_URL}/static/${cert.pdfPath}` });
});

app.listen(PORT, () => console.log(`Cert Backend running on port ${PORT}`));