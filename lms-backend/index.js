require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'generated_certificates')));

// Config
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_SECURE = (process.env.SMTP_SECURE === 'true');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || 'LMS FOR LEARNING <no-reply@localhost>';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CERT_DIR = process.env.CERT_DIR || path.join(__dirname, 'generated_certificates');
const CERTS_DB = path.join(__dirname, 'certs.json');

fs.ensureDirSync(CERT_DIR);
if (!fs.existsSync(CERTS_DB)) fs.writeJsonSync(CERTS_DB, {});

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

// Helper to load/save cert DB
function loadCerts() {
  try {
    return fs.readJsonSync(CERTS_DB);
  } catch (e) {
    return {};
  }
}
function saveCerts(data) {
  fs.writeJsonSync(CERTS_DB, data, { spaces: 2 });
}

// Generate nicely styled PDF certificate
async function generateCertificatePDF({ id, name, course, date }) {
  const pdfPath = path.join(CERT_DIR, `${id}.pdf`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Background / border
    doc.rect(10, 10, doc.page.width - 20, doc.page.height - 20).lineWidth(5).stroke('#1a73e8');

    // Heading
    doc.font('Times-Bold').fontSize(28).fillColor('#1d4ed8').text('Certificate of Completion', { align: 'center', underline: false });
    doc.moveDown(1);

    doc.font('Helvetica').fontSize(14).fillColor('#333').text('This is to certify that', { align: 'center' });
    doc.moveDown(0.5);

    // Student name
    doc.font('Times-Bold').fontSize(26).fillColor('#000').text(name, { align: 'center' });
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(14).fillColor('#333').text('has successfully completed the course', { align: 'center' });
    doc.moveDown(0.5);

    // Course name
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#1d4ed8').text(course, { align: 'center' });
    doc.moveDown(1.5);

    // Body paragraph
    doc.font('Helvetica').fontSize(12).fillColor('#444').text(
      `This certificate verifies that ${name} has completed the required lessons and assessments for the course "${course}".`,
      {
        align: 'center',
        lineGap: 4,
        paragraphGap: 6,
        width: doc.page.width - 160
      }
    );

    doc.moveDown(3);

    // Footer with signature and metadata
    const leftX = 90;
    const rightX = doc.page.width - 280;

    // Signature (simulated)
    doc.moveTo(leftX, doc.y).lineTo(leftX + 180, doc.y).stroke('#111');
    doc.font('Helvetica-Bold').fontSize(12).text('Festo Erick Mapunda', leftX, doc.y + 6, { align: 'left' });
    doc.font('Helvetica').fontSize(10).text('Founder & Developer — LMS FOR LEARNING', leftX, doc.y + 22);

    // Date & ID
    doc.font('Helvetica-Bold').fontSize(10).text('Date:', rightX, doc.y - 14);
    doc.font('Helvetica').fontSize(10).text(date, rightX + 40, doc.y - 14);

    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(10).text('Certificate ID:', rightX, doc.y);
    doc.font('Helvetica').fontSize(10).text(id, rightX + 80, doc.y);

    // QR code link (we'll embed the verification link as text for now; front-end renders QR)
    const verifyUrl = `${BASE_URL}/verify.html?id=${id}`;
    doc.moveDown(2);
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666').text(`Verify at: ${verifyUrl}`, { align: 'center' });

    doc.end();

    stream.on('finish', () => resolve(pdfPath));
    stream.on('error', reject);
  });
}

// API: health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API: generate certificate & email it
// POST body: { name, email, course }
app.post('/api/send-certificate', async (req, res) => {
  try {
    const { name, email, course } = req.body;
    if (!name || !email || !course) return res.status(400).json({ error: 'Missing name/email/course' });

    // Create ID
    const id = 'LMS-' + Math.floor(Math.random() * 900000 + 100000);

    // Date
    const date = new Date().toDateString();

    // Generate PDF
    const pdfPath = await generateCertificatePDF({ id, name, course, date });

    // Save in DB
    const certs = loadCerts();
    certs[id] = { id, name, email, course, date, pdfPath: path.relative(__dirname, pdfPath) };
    saveCerts(certs);

    // Send email with attachment
    const verifyUrl = `${BASE_URL}/verify.html?id=${id}`;
    const mailOptions = {
      from: FROM_EMAIL,
      to: email,
      subject: `Your Certificate — ${course} — LMS FOR LEARNING`,
      text: `Congratulations ${name}!\n\nAttached is your certificate for ${course}.\nYou can also verify it here: ${verifyUrl}\n\nRegards,\nLMS FOR LEARNING`,
      html: `<p>Dear <strong>${name}</strong>,</p>
             <p>Congratulations on completing <strong>${course}</strong>.</p>
             <p>Your official certificate is attached. You can also verify it online using <a href="${verifyUrl}">this link</a>.</p>
             <p>Regards,<br/>LMS FOR LEARNING</p>`,
      attachments: [
        { filename: `${id}.pdf`, path: pdfPath }
      ]
    };

    await transporter.sendMail(mailOptions);

    return res.json({ ok: true, id, verifyUrl });
  } catch (err) {
    console.error('send-certificate error', err);
    return res.status(500).json({ error: 'server error', details: String(err) });
  }
});

// API: verification by ID (returns JSON)
app.get('/api/verify/:id', (req, res) => {
  const id = req.params.id;
  const certs = loadCerts();
  if (!certs[id]) return res.status(404).json({ valid: false, error: 'Not found' });
  const c = certs[id];
  res.json({ valid: true, id: c.id, name: c.name, email: c.email, course: c.course, date: c.date, pdfUrl: `${BASE_URL}/static/${c.id}.pdf` });
});

// Static verify page (optional)
// If you host the frontend at the same domain, you can keep verify.html there; backend only offers /api/verify/:id

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LMS cert backend running on port ${PORT}`));
