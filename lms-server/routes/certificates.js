const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { protect } = require('../middleware/auth'); 
const Certificate = require('../models/Certificate'); 
const User = require('../models/User'); 
const QuizResult = require('../models/QuizResult'); // Confirmed: Capital Q

// --- 1. EMAIL HELPER FUNCTION ---
async function sendCertificateEmail(userEmail, studentName, courseName, certCode) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("⚠️ Email credentials not set in .env");
        throw new Error("Email credentials missing");
    }

    // Updated Transporter: Changed secure to false for Port 587 and added timeouts
    let transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // Must be false for 587
        auth: { 
            user: process.env.EMAIL_USER, 
            pass: process.env.EMAIL_PASS 
        },
        tls: { 
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2'
        },
        connectionTimeout: 10000, // 10 seconds timeout
        greetingTimeout: 10000
    });

    const mailOptions = {
        from: `"NextGen-LMS Academy" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: `🏆 Congratulations! Your Certificate for ${courseName}`,
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; border: 15px solid #0a1d37; padding: 40px; text-align: center; background-color: #fff;">
                <h1 style="color: #0a1d37; font-size: 28px;">Distinguished Achievement</h1>
                <p style="color: #c5a059; font-weight: bold; letter-spacing: 2px;">CERTIFICATE OF COMPLETION</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; width: 50%; margin: 20px auto;">
                <p style="font-size: 18px; color: #1e293b;">Great Job, <b>${studentName}</b>!</p>
                <p style="color: #64748b;">You have successfully completed all requirements for:</p>
                <h2 style="color: #0a1d37;">${courseName}</h2>
                <p style="font-size: 14px; color: #94a3b8;">Verification Code: <span style="font-family: monospace;">${certCode}</span></p>
                <br><br>
                <a href="http://localhost:5500/certificate.html?code=${certCode}" 
                   style="background:#0a1d37; color:#fff; padding:15px 30px; text-decoration:none; border-radius:5px; font-weight:bold; border: 1px solid #c5a059;">
                   DOWNLOAD CERTIFICATE
                </a>
                <p style="margin-top: 40px; font-size: 12px; color: #cbd5e1;">© 2026 NextGen-LMS Academy</p>
            </div>`
    };

    return await transporter.sendMail(mailOptions);
}

// --- 2. ELIGIBILITY CHECK (GET) ---
router.get('/check/:courseId', protect, async (req, res) => {
    try {
        const certificate = await Certificate.findOne({ user: req.user.id, course: req.params.courseId });
        
        if (certificate) {
            return res.json({ certificate, isEligible: true });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        let progress = 0;
        if (user.progress) {
            progress = (typeof user.progress.get === 'function') 
                ? (user.progress.get(req.params.courseId) || 0) 
                : (user.progress[req.params.courseId] || 0);
        }

        const quizPass = await QuizResult.findOne({ 
            user: req.user.id, 
            course: req.params.courseId, 
            score: { $gte: 75 } 
        });

        res.json({
            certificate: null,
            isEligible: progress >= 100 && quizPass !== null,
            progress: progress,
            quizPassed: !!quizPass,
            registeredName: user.name 
        });
    } catch (error) {
        console.error("Eligibility Error:", error);
        res.status(500).json({ message: "Error checking eligibility." });
    }
});

// --- 2.5 SAVE QUIZ RESULT (POST) ---
router.post('/check/:courseId', protect, async (req, res) => {
    try {
        const { score, quizPassed } = req.body;
        const courseId = req.params.courseId;
        const userId = req.user.id;

        const result = await QuizResult.findOneAndUpdate(
            { user: userId, course: courseId },
            { 
                score: score, 
                passed: quizPassed,
                updatedAt: Date.now() 
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ 
            message: "Quiz result saved successfully", 
            result 
        });
    } catch (error) {
        console.error("❌ Quiz Save Error:", error);
        res.status(500).json({ message: "Failed to save quiz result." });
    }
});

// --- 3. GENERATION & INITIAL SAVE ---
router.post('/generate', protect, async (req, res) => {
    try {
        const { courseId, courseName, pdfData } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ message: "User not found" });

        const quizPass = await QuizResult.findOne({ 
            user: req.user.id, 
            course: courseId, 
            score: { $gte: 75 } 
        });

        if (!quizPass) {
            return res.status(403).json({ message: "Unauthorized: You must pass the quiz (75%+) to generate a certificate." });
        }

        const existing = await Certificate.findOne({ user: req.user.id, course: courseId });
        if (existing) return res.status(400).json({ message: "Certificate already issued." });

        const newCertificate = new Certificate({
            user: req.user.id,
            course: courseId,
            certificateCode: `LMS-${Date.now().toString(36).toUpperCase()}`,
            courseName: courseName || "Course Completed",
            studentName: user.name, 
            pdfData: pdfData 
        });

        const savedCert = await newCertificate.save();
        
        sendCertificateEmail(user.email, savedCert.studentName, savedCert.courseName, savedCert.certificateCode)
            .catch(err => console.error("❌ Auto-Email Error:", err.message));

        res.status(201).json({ message: "Success", certificate: savedCert });
    } catch (error) {
        console.error("❌ Save Error:", error);
        res.status(500).json({ message: "Save failed.", details: error.message });
    }
});

// --- 4. MANUAL EMAIL RESEND (Updated with robust Error Handling) ---
router.post('/send-email', protect, async (req, res) => {
    try {
        const { certificateCode } = req.body;
        
        if (!certificateCode) {
            return res.status(400).json({ message: "Certificate code is required." });
        }

        const cert = await Certificate.findOne({ certificateCode, user: req.user.id });
        
        if (!cert) return res.status(404).json({ message: "Certificate not found." });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found." });

        await sendCertificateEmail(user.email, cert.studentName, cert.courseName, cert.certificateCode);

        res.json({ message: "Email sent successfully!" });
    } catch (error) {
        console.error("❌ Resend Route Error:", error);
        res.status(500).json({ 
            message: "Email service failed.", 
            details: error.message 
        });
    }
});

// --- 5. PUBLIC VERIFICATION ---
router.get('/verify/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const certificate = await Certificate.findOne({ 
            certificateCode: { $regex: new RegExp(`^${code}$`, 'i') } 
        });
        
        if (!certificate) return res.status(404).json({ message: 'Invalid certificate code.' });
        
        res.json({ certificate });
    } catch (error) {
        res.status(500).json({ message: 'Server error during verification.' });
    }
});

// --- 6. DASHBOARD DATA FETCH ---
router.get('/my', protect, async (req, res) => {
    try {
        const certificates = await Certificate.find({ user: req.user.id }).sort({ createdAt: -1 }); 
        res.json(certificates);
    } catch (error) {
        console.error("❌ Dashboard Certificates Error:", error);
        res.status(500).json({ message: "Could not load certificates." });
    }
});

// --- 7. ADMIN DATA FETCH ---
router.get('/all', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }
        
        const certificates = await Certificate.find({})
            .populate('user', 'name email')
            .sort({ createdAt: -1 });
            
        res.json(certificates);
    } catch (error) {
        console.error("❌ Admin Certificates Error:", error);
        res.status(500).json({ message: "Could not load all certificates." });
    }
});

module.exports = router;