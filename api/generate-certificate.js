// api/generate-certificate.js
import { Buffer } from "buffer";
import PDFDocument from "pdfkit";
import admin from "firebase-admin";
import sgMail from "@sendgrid/mail";

// Initialize Firebase Admin using service account JSON from env
if (!admin.apps.length) {
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svcJson) throw new Error("FIREBASE_SERVICE_ACCOUNT env var missing");
  const svc = JSON.parse(svcJson);
  admin.initializeApp({
    credential: admin.credential.cert(svc),
    storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// helper: generate PDF buffer with PDFKit
async function generatePdfBuffer({ studentName, courseName, issueDate, certCode, logoBuffer }) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const finish = new Promise((res) => doc.on("end", res));

  // subtle watermark
  doc.save();
  doc.fontSize(80).fillColor("#f3f4f6").opacity(0.12);
  doc.rotate(-18, { origin: [400, 300] });
  doc.text("LMS FOR LEARNING", 60, 140, { align: "center", width: 900 });
  doc.rotate(18, { origin: [400, 300] }).opacity(1).fillColor("black");
  doc.restore();

  // optional logo
  if (logoBuffer) {
    try { doc.image(logoBuffer, doc.page.width / 2 - 60, 40, { width: 120 }); } catch (e) { /* ignore */ }
  }

  doc.moveDown(4);
  doc.fontSize(28).fillColor("#0b3d91").font("Helvetica-Bold");
  doc.text("Certificate of Completion", { align: "center" });

  doc.moveDown(1);
  doc.fontSize(12).fillColor("#4b5563").font("Helvetica");
  doc.text("This is to certify that", { align: "center" });

  doc.moveDown(0.6);
  doc.fontSize(26).fillColor("#111827").font("Helvetica-Bold");
  doc.text(studentName, { align: "center" });

  doc.moveDown(0.6);
  doc.fontSize(12).fillColor("#4b5563").font("Helvetica");
  doc.text("has successfully completed the course", { align: "center" });

  doc.moveDown(0.8);
  doc.fontSize(18).fillColor("#0b3d91").font("Helvetica-Bold");
  doc.text(courseName, { align: "center" });

  doc.moveDown(1.8);
  doc.fontSize(12).fillColor("#374151");
  doc.text(`Issued on ${issueDate}`, { align: "center" });

  const bottomY = doc.page.height - 120;
  doc.fontSize(10).fillColor("#6b7280");
  doc.text(`Certificate ID: ${certCode}`, 60, bottomY);

  doc.fontSize(10).fillColor("#374151");
  doc.text("__________________________", doc.page.width - 260, bottomY - 10);
  doc.fontSize(11).fillColor("#6b7280");
  doc.text("Director, LMS FOR LEARNING", doc.page.width - 260, bottomY + 6);

  doc.end();
  await finish;
  return Buffer.concat(chunks);
}

// handler
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { idToken, courseId, courseName, studentName: studentNameOverride } = req.body;
    if (!idToken || !courseId || !courseName) return res.status(400).json({ error: "Missing parameters" });

    // verify id token
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // load user profile
    const uSnap = await db.collection("users").doc(uid).get();
    if (!uSnap.exists) return res.status(400).json({ error: "User profile missing" });
    const userData = uSnap.data();
    const studentName = studentNameOverride || userData.name || decoded.email || "Learner";
    const email = userData.email || decoded.email;

    // check progress
    const progress = userData.progress && userData.progress[courseId] ? Number(userData.progress[courseId]) : 0;
    if (progress < 100) return res.status(403).json({ error: "Course not complete" });

    // generate code & date
    const certCode = `LMS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const issueDate = new Date().toLocaleDateString();

    // optional logo from bucket (hero.png)
    let logoBuffer = null;
    try {
      const logoFile = bucket.file("hero.png");
      const [exists] = await logoFile.exists();
      if (exists) {
        const [buf] = await logoFile.download();
        logoBuffer = buf;
      }
    } catch (e) { logoBuffer = null; }

    // generate pdf
    const pdfBuffer = await generatePdfBuffer({ studentName, courseName, issueDate, certCode, logoBuffer });

    // upload to storage
    const destPath = `certificates/${uid}/${certCode}.pdf`;
    const file = bucket.file(destPath);
    await file.save(pdfBuffer, {
      metadata: { contentType: "application/pdf", metadata: { firebaseStorageDownloadTokens: certCode } },
      resumable: false
    });

    // signed url (long expiry)
    const [signedUrl] = await file.getSignedUrl({ action: "read", expires: "2999-01-01" });

    // save record
    const certRef = await db.collection("certificates").add({
      uid,
      certificateCode: certCode,
      courseId,
      courseName,
      studentName,
      pdfUrl: signedUrl,
      issuedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // send email (if configured)
    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      const msg = {
        to: email,
        from: process.env.SENDGRID_FROM,
        subject: `Your certificate — ${courseName}`,
        html: `<p>Hi ${studentName},</p>
               <p>Congratulations — your certificate for <strong>${courseName}</strong> is ready.</p>
               <p><a href="${signedUrl}">Download Certificate (PDF)</a></p>
               <p>Certificate ID: ${certCode}</p>
               <p>Regards,<br/>LMS FOR LEARNING</p>`
      };
      try { await sgMail.send(msg); } catch (e) { console.error("SendGrid send error:", e?.message || e); }
    }

    return res.json({ ok: true, certCode, pdfUrl: signedUrl, docId: certRef.id });
  } catch (err) {
    console.error("generate cert error", err);
    return res.status(500).json({ error: String(err) });
  }
}
