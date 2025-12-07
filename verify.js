// verify.js
import { db } from "./firebase.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const codeInput = document.getElementById("codeInput");
const verifyBtn = document.getElementById("verifyBtn");
const result = document.getElementById("verifyResult");

async function verifyCode(code) {
  result.innerHTML = "Checking…";
  try {
    const q = query(collection(db, "certificates"), where("certificateCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) {
      result.innerHTML = `<p class="small">Certificate not found or invalid code.</p>`;
      return;
    }
    // assume first match
    const docSnap = snap.docs[0];
    const data = docSnap.data();
    const issued = data.issuedAt && data.issuedAt.toDate ? data.issuedAt.toDate().toLocaleDateString() : data.issuedAt || 'N/A';
    result.innerHTML = `
      <div style="padding:12px;border-radius:8px;background:#f6f8fa;">
        <h3>Certificate Verified</h3>
        <p><strong>Name:</strong> ${data.studentName}</p>
        <p><strong>Course:</strong> ${data.courseName}</p>
        <p><strong>Issued:</strong> ${issued}</p>
        <p><strong>Certificate ID:</strong> ${data.certificateCode}</p>
        <p><a href="${data.pdfUrl}" target="_blank">Open certificate PDF</a></p>
      </div>
    `;
  } catch (err) {
    console.error(err);
    result.innerHTML = "<p class='small'>Error checking certificate. See console.</p>";
  }
}

verifyBtn.addEventListener("click", () => {
  const code = codeInput.value.trim();
  if (!code) return alert("Enter code");
  verifyCode(code);
});

// also support ?code=... in URL
const urlParams = new URLSearchParams(window.location.search);
const c = urlParams.get("code");
if (c) {
  codeInput.value = c;
  verifyCode(c);
}
