const API_BASE_URL = 'http://localhost:5001/api';

document.addEventListener("DOMContentLoaded", () => {
    checkEligibilityAndLoad();
    
    // Core Event Listeners
    document.getElementById("generateBtn").addEventListener("click", handleGenerate);
    document.getElementById("downloadBtn").addEventListener("click", downloadPDF);
    document.getElementById("emailBtn").addEventListener("click", handleEmailResend);
});

/**
 * Loads the certificate state: Public Verify, Eligible to Generate, or Already Issued
 */
async function checkEligibilityAndLoad() {
    const statusLine = document.getElementById("statusLine");
    const generateBtn = document.getElementById("generateBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    const emailBtn = document.getElementById("emailBtn");

    const params = new URLSearchParams(window.location.search);
    const certCodeParam = params.get("code"); 
    // Get ID from URL or fallback to LocalStorage
    const courseId = params.get("id") || params.get("courseId") || localStorage.getItem("currentCourseId");
    const token = localStorage.getItem('token');

    try {
        // --- MODE 1: Public Verification Link (No login required) ---
        if (certCodeParam) {
            const res = await fetch(`${API_BASE_URL}/certificates/verify/${certCodeParam}`);
            const data = await res.json();
            if (res.ok) {
                renderCertToUI(data.certificate);
                statusLine.textContent = "Verified Official Certificate.";
                return; 
            }
        }

        // --- MODE 2: Student Dashboard View (Login required) ---
        if (!token) {
            statusLine.textContent = "Please log in to view your certificate.";
            return;
        }

        if (!courseId) {
            statusLine.textContent = "No course selected. Return to dashboard.";
            return;
        }

        // We use the /check endpoint which now checks both Lesson Progress AND Quiz Score
        const res = await fetch(`${API_BASE_URL}/certificates/check/${courseId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.certificate) {
            // SCENARIO A: Certificate already exists in Database
            renderCertToUI(data.certificate);
            statusLine.textContent = "Your official certificate is ready.";
            downloadBtn.style.display = "inline-block";
            emailBtn.style.display = "inline-block"; 
            
        } else if (data.isEligible) {
            // SCENARIO B: Lessons 100% AND Quiz Passed (Eligible to Generate)
            statusLine.textContent = "Congratulations! You are eligible.";
            generateBtn.style.display = "inline-block";
            
            // Preview data onto the template before user clicks Generate
            document.getElementById("certName").textContent = data.registeredName || localStorage.getItem('userName') || "Student";
            document.getElementById("certCourse").textContent = localStorage.getItem("currentCourseTitle") || "Course Completed";
            document.getElementById("certDate").textContent = new Date().toLocaleDateString();
            document.getElementById("certCode").textContent = "PENDING";
            
        } else {
            // SCENARIO C: Not finished or Quiz not passed
            statusLine.textContent = data.message || `Requirement not met. Ensure lessons are 100% and Quiz is passed.`;
            
            // If they aren't eligible, show a "Back to Course" button after 1 second
            setTimeout(() => {
                if (!data.isEligible && !data.certificate) {
                    // FIXED: Redirecting to course-details.html (plural)
                    statusLine.innerHTML += `<br><a href="course-details.html?id=${courseId}" style="color:#0b3d91; font-weight:bold;">Return to Course</a>`;
                }
            }, 1000);
        }

    } catch (err) {
        console.error("Load Error:", err);
        statusLine.textContent = "Connection error. Ensure server is running.";
    }
}

/**
 * Renders data into the Certificate Template UI
 */
function renderCertToUI(cert) {
    document.getElementById("certName").textContent = cert.studentName;
    document.getElementById("certCourse").textContent = cert.courseName;
    document.getElementById("certCode").textContent = cert.certificateCode;
    
    const issueDate = cert.createdAt ? new Date(cert.createdAt) : new Date();
    document.getElementById("certDate").textContent = issueDate.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    // Generate QR Code for Verification
    const qrContainer = document.getElementById('certQR');
    if (qrContainer) {
        qrContainer.innerHTML = ""; 
        new QRious({
            element: qrContainer.appendChild(document.createElement('canvas')),
            value: `${window.location.origin}/certificate.html?code=${cert.certificateCode}`,
            size: 100,
            level: 'H'
        });
    }
}

/**
 * Captures the HTML as an image, converts to PDF, and saves to Database
 */
async function handleGenerate() {
    const token = localStorage.getItem('token');
    const courseId = localStorage.getItem("currentCourseId");
    const courseTitle = localStorage.getItem("currentCourseTitle") || "Course Completed";
    const generateBtn = document.getElementById("generateBtn");

    if (!courseId) return alert("Course ID missing.");

    generateBtn.disabled = true;
    generateBtn.textContent = "⌛ Securing & Saving...";

    try {
        const element = document.getElementById("certificateCanvas");
        // Using scale 1.5 for the perfect balance of quality and DB storage limits
        const canvas = await html2canvas(element, { scale: 1.5, useCORS: true });
        const imgData = canvas.toDataURL("image/png");
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF("l", "px", [800, 600]);
        pdf.addImage(imgData, "PNG", 0, 0, 800, 600);
        const pdfBase64 = pdf.output('datauristring');

        const res = await fetch(`${API_BASE_URL}/certificates/generate`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
                courseId: courseId, 
                courseName: courseTitle, 
                pdfData: pdfBase64 
            })
        });

        if (res.ok) {
            alert("Success! Certificate generated, saved, and emailed.");
            location.reload(); 
        } else {
            const result = await res.json();
            alert("Error: " + (result.message || "Failed to save."));
            generateBtn.disabled = false;
            generateBtn.textContent = "Generate Certificate";
        }
    } catch (err) {
        console.error("Generation Error:", err);
        generateBtn.disabled = false;
        alert("Failed to capture certificate image.");
    }
}

/**
 * Resend the certificate email via Backend
 */
async function handleEmailResend() {
    const codeElement = document.getElementById("certCode");
    const code = codeElement ? codeElement.textContent.trim() : "";
    const token = localStorage.getItem('token');
    const emailBtn = document.getElementById("emailBtn");

    if (code === "—" || code === "PENDING" || !code) return alert("No valid certificate to send.");

    emailBtn.disabled = true;
    emailBtn.textContent = "⌛ Sending...";

    try {
        const res = await fetch(`${API_BASE_URL}/certificates/send-email`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ certificateCode: code })
        });

        if (res.ok) {
            alert("Email sent successfully!");
        } else {
            const errorData = await res.json();
            alert("Could not send email: " + (errorData.message || "Unknown error"));
        }
    } catch (err) {
        alert("Server connection failed.");
    } finally {
        emailBtn.disabled = false;
        emailBtn.textContent = "Email Certificate";
    }
}

/**
 * High-quality download for the student
 */
async function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const element = document.getElementById("certificateCanvas");
    const canvas = await html2canvas(element, { scale: 2 }); 
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("l", "px", [800, 600]);
    pdf.addImage(imgData, "PNG", 0, 0, 800, 600);
    const code = document.getElementById("certCode").textContent;
    pdf.save(`Certificate-${code}.pdf`);
}