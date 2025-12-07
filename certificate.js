// certificate.js
import { auth, db, storage } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { ref as storageRef, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";
import { httpsCallable, getFunctions } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";

// html2canvas & jspdf are global via CDN; use them via window.html2canvas and jspdf
const generateBtn = document.getElementById("generateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const emailBtn = document.getElementById("emailBtn");
const statusLine = document.getElementById("statusLine");
const certMeta = document.getElementById("certMeta");

let currentUser = null;
let currentCourseId = null;
let currentCourseName = null;
let certificateDoc = null; // Firestore doc data if exists
let lastPdfDataUrl = null;
let lastCertId = null;

// simple unique code generator
function makeCertCode() {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2,8).toUpperCase();
  return `LMS-${now}-${rand}`;
}

// render certificate DOM with user & course info
function fillCertificateTemplate(name, course, issueDate, code) {
  document.getElementById("certName").textContent = name;
  document.getElementById("certCourse").textContent = course;
  document.getElementById("certDate").textContent = issueDate;
  document.getElementById("certCode").textContent = code;
}

// create QR (data URL) using QRious
function createQRCode(url) {
  const qr = new QRious({
    value: url,
    size: 160,
    level: 'M'
  });
  return qr.toDataURL();
}

// convert the certificate DOM to a high-res PDF (A4 landscape-ish)
async function exportCertificatePdf() {
  const el = document.getElementById("certificateCanvas");

  // use html2canvas for screenshot
  const canvas = await html2canvas(el, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL("image/png");

  const { jsPDF } = window.jspdf;
  // A4 landscape
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4"
  });
  // compute image size to fit page
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // draw image
  pdf.addImage(imgData, 'PNG', 20, 20, pageWidth - 40, pageHeight - 40);
  const dataUrl = pdf.output('datauristring');
  return { dataUrl, blob: pdf.output('blob'), pdf };
}

// upload base64/pdf to Firebase Storage and return URL
async function uploadPdfToStorage(uid, certCode, dataUrl) {
  // store under /certificates/{uid}/{certCode}.pdf
  const path = `certificates/${uid}/${certCode}.pdf`;
  const ref = storageRef(storage, path);
  // dataUrl is a data:application/pdf;base64,....
  // uploadString expects 'data_url' format
  await uploadString(ref, dataUrl, 'data_url');
  const url = await getDownloadURL(ref);
  return url;
}

// save certificate metadata to Firestore
async function saveCertificateRecord(uid, certCode, courseId, courseName, studentName, pdfUrl, score) {
  const payload = {
    uid,
    certificateCode: certCode,
    courseId,
    courseName,
    studentName,
    pdfUrl,
    score: score || null,
    issuedAt: serverTimestamp()
  };
  // add doc to collection certificates (doc id will be auto)
  const docRef = await addDoc(collection(db, "certificates"), payload);
  return { id: docRef.id, ...payload };
}

// check eligibility (progress >=100) and load existing certificate if any
async function checkEligibilityAndLoad() {
  statusLine.textContent = "Checking your certificate eligibility…";
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      statusLine.textContent = "Please log in to generate or download certificates.";
      generateBtn.disabled = true;
      return;
    }
    currentUser = user;
    // Determine courseId from query param ?course=courseId or from localStorage fallback
    const params = new URLSearchParams(location.search);
    currentCourseId = params.get("course") || params.get("courseId") || localStorage.getItem("currentCourseId");
    if (!currentCourseId) {
      statusLine.textContent = "No course specified. Open certificate from course page.";
      generateBtn.disabled = true;
      return;
    }

    // Load user's progress for this course
    const uRef = doc(db, "users", user.uid);
    const uSnap = await getDoc(uRef);
    if (!uSnap.exists()) {
      statusLine.textContent = "User profile not found in database.";
      generateBtn.disabled = true;
      return;
    }
    const ud = uSnap.data();
    currentCourseName = (ud.courseNames && ud.courseNames[currentCourseId]) || currentCourseId;

    const progress = ud.progress && ud.progress[currentCourseId] ? ud.progress[currentCourseId] : 0;
    // attempt to find existing certificate record for this user & course
    const certsSnap = await getDocs(collection(db, "certificates"));
    let found = null;
    certsSnap.forEach(s => {
      const c = s.data();
      if (c.uid === user.uid && c.courseId === currentCourseId) {
        found = { id: s.id, ...c };
      }
    });

    if (found) {
      certificateDoc = found;
      lastCertId = found.certificateCode || found.certificateCode || found.certificateCode;
      statusLine.textContent = `Certificate already issued on ${found.issuedAt?.toDate ? found.issuedAt.toDate().toLocaleDateString() : 'date'}.`;
      downloadBtn.style.display = "inline-block";
      emailBtn.style.display = "inline-block";
      generateBtn.style.display = "none";
      fillCertificateTemplate(found.studentName, found.courseName, found.issuedAt?.toDate ? found.issuedAt.toDate().toLocaleDateString() : new Date().toLocaleDateString(), found.certificateCode || found.certificateCode || '—');
      // get download url if exists
      certMeta.innerText = `Certificate ID: ${found.certificateCode || '—'}`;
      return;
    }

    // not found -> check eligibility
    if (progress >= 100) {
      statusLine.textContent = "You are eligible to generate a certificate. Click Generate Certificate.";
      generateBtn.disabled = false;
      generateBtn.style.display = "inline-block";
    } else {
      statusLine.textContent = `Course progress: ${progress}%. You need 100% to generate certificate.`;
      generateBtn.disabled = true;
    }
  });
}

// hookup UI
generateBtn.addEventListener("click", async () => {
  if (!currentUser) { alert("Login first."); return; }
  generateBtn.disabled = true;
  statusLine.textContent = "Generating certificate…";

  // prepare cert info
  const studentName = currentUser.displayName || (await getDoc(doc(db, "users", currentUser.uid))).data().name || currentUser.email;
  const courseName = currentCourseName || currentCourseId;
  const issueDate = new Date().toLocaleDateString();
  const certCode = makeCertCode();

  // fill the template DOM
  fillCertificateTemplate(studentName, courseName, issueDate, certCode);

  try {
    // render to PDF
    const { dataUrl } = await exportCertificatePdf(); // dataUrl is datauristring
    lastPdfDataUrl = dataUrl;

    // upload to storage
    statusLine.textContent = "Uploading certificate to server…";
    const pdfUrl = await uploadPdfToStorage(currentUser.uid, certCode, dataUrl);

    // save Firestore record
    statusLine.textContent = "Saving certificate metadata…";
    const rec = await saveCertificateRecord(currentUser.uid, certCode, currentCourseId, courseName, studentName, pdfUrl, null);
    certificateDoc = rec;
    lastCertId = certCode;

    statusLine.textContent = "Certificate generated successfully.";
    certMeta.innerText = `Certificate ID: ${certCode}`;

    // render QR to point to verification page (verify.html?code=certCode)
    const verifyUrl = `${location.origin}/verify.html?code=${encodeURIComponent(certCode)}`;
    const qrDataUrl = createQRCode(verifyUrl);
    document.getElementById("certQR").innerHTML = `<img src="${qrDataUrl}" alt="QR">`;

    // show download + email buttons
    downloadBtn.style.display = "inline-block";
    emailBtn.style.display = "inline-block";
    generateBtn.style.display = "none";

  } catch (err) {
    console.error("Certificate generation failed", err);
    statusLine.textContent = "Certificate generation failed (see console).";
    generateBtn.disabled = false;
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!lastPdfDataUrl) {
    // if not in-memory, attempt to fetch from certificateDoc.pdfUrl
    if (certificateDoc && certificateDoc.pdfUrl) {
      window.open(certificateDoc.pdfUrl, "_blank");
      return;
    }
    alert("No certificate PDF available to download.");
    return;
  }
  // create a temporary link
  const a = document.createElement("a");
  a.href = lastPdfDataUrl;
  a.download = `${currentCourseId || 'certificate'}_${currentUser.uid}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

emailBtn.addEventListener("click", async () => {
  // call cloud function to email certificate
  if (!certificateDoc) { alert("No certificate record found to email."); return; }
  statusLine.textContent = "Requesting email sending…";

  try {
    const functions = getFunctions();
    const sendCertFn = httpsCallable(functions, 'sendCertificateEmail');
    const res = await sendCertFn({ certificateId: certificateDoc.certificateCode || certificateDoc.certificateCode, email: currentUser.email, pdfUrl: certificateDoc.pdfUrl || certificateDoc.pdfUrl });
    if (res.data && res.data.success) {
      statusLine.textContent = "Email sent successfully.";
    } else {
      statusLine.textContent = "Email request sent (check logs).";
    }
  } catch (err) {
    console.error("Email function error", err);
    statusLine.textContent = "Failed to send email (see console).";
  }
});

// init
checkEligibilityAndLoad();
