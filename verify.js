// verify.js - Public verification logic for NextGen-LMS
const API_BASE_URL = 'http://localhost:5001/api';

const verifyBtn = document.getElementById("verifyBtn");
const codeInput = document.getElementById("codeInput");
const resultCard = document.getElementById("verifyResult");
const statusMsg = document.getElementById("statusMessage");

// Result Fields
const resStudent = document.getElementById("resStudent");
const resCourse = document.getElementById("resCourse");
const resDate = document.getElementById("resDate");
const resId = document.getElementById("resId");

/**
 * Main verification function
 */
async function performVerification(code) {
    // Basic validation: ignore empty or tiny inputs
    if (!code || code.trim().length < 5) {
        statusMsg.textContent = "Please enter a valid certificate code.";
        statusMsg.style.color = "#ef4444";
        return;
    }

    const cleanCode = code.trim().toUpperCase();

    // Reset UI for new search
    resultCard.style.display = "none";
    resultCard.classList.remove("error-card");
    statusMsg.textContent = "🔍 Searching secure records...";
    statusMsg.style.color = "#64748b";
    verifyBtn.disabled = true;

    try {
        // GET request to public verification route
        const res = await fetch(`${API_BASE_URL}/certificates/verify/${cleanCode}`);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || "Credential not found in our records.");
        }

        // --- SUCCESS STATE ---
        statusMsg.textContent = "";
        resultCard.style.display = "block";
        
        // Populate fields with data from MongoDB
        resStudent.textContent = data.certificate.studentName;
        resCourse.textContent = data.certificate.courseName;
        resDate.textContent = new Date(data.certificate.issuedAt).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
        resId.textContent = data.certificate.certificateCode;

    } catch (err) {
        // --- ERROR STATE ---
        statusMsg.textContent = "";
        resultCard.style.display = "block";
        resultCard.classList.add("error-card");
        
        // Using innerHTML here carefully to show a clear failure UI
        resultCard.innerHTML = `
            <div class="verify-badge" style="background:#ef4444; color:white; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:bold; display:inline-block;">✕ INVALID</div>
            <h2 style="margin:10px 0; color: #1e293b;">Verification Failed</h2>
            <p style="color:#64748b;">The code <strong>${cleanCode}</strong> could not be verified.</p>
            <p style="font-size: 13px; color:#ef4444;">Reason: ${err.message}</p>
        `;
    } finally {
        verifyBtn.disabled = false;
    }
}

// Event: Button Click
verifyBtn.addEventListener("click", () => {
    performVerification(codeInput.value);
});

// Event: Enter Key support for better UX
codeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        performVerification(codeInput.value);
    }
});

/**
 * Auto-run if code is in URL (Perfect for QR code scans)
 * Example URL: verify.html?code=LMS-ABCD-1234
 */
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get("code") || params.get("id");
    
    if (codeFromUrl) {
        codeInput.value = codeFromUrl;
        performVerification(codeFromUrl);
    }
});