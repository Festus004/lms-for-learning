// course-detail.js — STRICT FLOW: Lessons -> Quiz -> Certificate
const API_BASE_URL = 'http://localhost:5001/api'; 

let COURSE_ID = null;
let lessons = []; 
let currentLessonId = null; 
let userCompleted = []; 

function qparam(name) { return new URLSearchParams(location.search).get(name); }
function getToken() { return localStorage.getItem('token'); }
function getLessonById(id) { return lessons.find(l => l._id === id); }

// ====================================================================
// CORE DATA FETCHING
// ====================================================================

async function loadCourseData() {
    COURSE_ID = qparam("id");
    if (!COURSE_ID) return;

    localStorage.setItem("currentCourseId", COURSE_ID);

    try {
        const res = await fetch(`${API_BASE_URL}/courses/${COURSE_ID}`);
        const data = await res.json();
        if (!res.ok) return;

        document.getElementById("courseTitle").textContent = data.title;
        document.getElementById("pageTitle").textContent = data.title;
        
        // Ensure lessons are sorted correctly
        lessons = (data.lessons || []).slice().sort((a, b) => (a.lessonOrder || 0) - (b.lessonOrder || 0));
        renderLessons();

        await checkUserAuthAndLoadProgress(COURSE_ID);

        if (lessons.length) loadLesson(lessons[0]._id);

        // This call checks if we should show Quiz or Certificate
        checkFinalActions();
    } catch (err) { console.error("Error loading course data:", err); }
}

// ====================================================================
// PROGRESS LOGIC
// ====================================================================

async function checkUserAuthAndLoadProgress(cId) {
    const token = getToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE_URL}/progress/${cId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        // Normalize IDs to strings for comparison
        userCompleted = (data.completedLessons || []).map(l => String(l._id || l)); 
        updateProgressUI(data.progressPercent || 0);
        highlightLessons();
    } catch (err) { console.error("Error fetching progress:", err); }
}

async function toggleMarkComplete() {
    const token = getToken();
    if (!token || !currentLessonId) return;
    
    try {
        const res = await fetch(`${API_BASE_URL}/progress/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ courseId: COURSE_ID, lessonId: currentLessonId })
        });
        const data = await res.json();
        userCompleted = (data.completedLessons || []).map(l => String(l._id || l));
        
        updateProgressUI(data.progressPercent || 0);
        highlightLessons();
        updateMarkButton();
        
        // Refresh visibility of Quiz/Cert buttons
        checkFinalActions(); 
    } catch (err) { alert("Error updating progress"); }
}

// ====================================================================
// THE STRICT GATEKEEPER
// ====================================================================

async function checkFinalActions() {
    console.log("Checking final actions...");
    const quizLink = document.getElementById("quizLink"); 
    const certBtn = document.getElementById("certLink");
    const token = getToken();

    // 1. HARD RESET: Force everything to stay hidden initially
    if (quizLink) quizLink.style.setProperty("display", "none", "important");
    if (certBtn) certBtn.style.setProperty("display", "none", "important");

    // 2. Are all lessons finished? (Check lengths)
    const isFinished = lessons.length > 0 && userCompleted.length === lessons.length;
    console.log(`Lessons: ${lessons.length}, Completed: ${userCompleted.length}, Finished: ${isFinished}`);

    if (!isFinished) {
        console.log("Course not 100% complete. Actions hidden.");
        return; 
    }

    // 3. Lessons are 100% complete. Now ask the server if user PASSED the quiz (>75%)
    try {
        const res = await fetch(`${API_BASE_URL}/certificates/check/${COURSE_ID}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const status = await res.json();
        console.log("Gatekeeper Status Received:", status);

        // 4. THE ENFORCEMENT LOGIC
        if (status.quizPassed === true || status.certificate) {
            // User passed the quiz! Show Certificate button.
            console.log("User passed! Showing Claim Certificate button.");
            certBtn.style.setProperty("display", "block", "important");
            if (quizLink) quizLink.style.setProperty("display", "none", "important");
            
            if (status.certificate) {
                // If already generated, just link to the viewer
                certBtn.onclick = () => { window.location.href = `certificate.html?id=${COURSE_ID}`; };
            } else {
                // Otherwise, trigger generator
                certBtn.onclick = generateCertificate;
            }
        } else {
            // Lessons done, but quiz either not taken or failed (<75%). Show Quiz Link.
            console.log("User has NOT passed quiz yet. Showing Quiz link.");
            if (quizLink) {
                quizLink.style.setProperty("display", "block", "important");
                quizLink.href = `quiz.html?id=${COURSE_ID}`;
            }
            certBtn.style.setProperty("display", "none", "important");
        }
    } catch (e) { 
        console.error("Gatekeeper server error:", e); 
    }
}

// ====================================================================
// CERTIFICATE GENERATION
// ====================================================================

async function generateCertificate() {
    const { jsPDF } = window.jspdf;
    const certElement = document.getElementById("certTemplate");
    const certBtn = document.getElementById("certLink");
    const token = getToken();

    certBtn.textContent = "⌛ Generating...";
    certBtn.disabled = true;

    document.getElementById("certStudentName").textContent = localStorage.getItem('userName') || "Student";
    document.getElementById("certCourseName").textContent = document.getElementById("courseTitle").textContent;
    document.getElementById("certDate").textContent = new Date().toLocaleDateString();
    const uniqueId = `LMS-${Date.now().toString(36).toUpperCase()}`;
    document.getElementById("certId").textContent = uniqueId;

    try {
        const canvas = await html2canvas(certElement, { scale: 2 });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("l", "px", [800, 600]);
        pdf.addImage(imgData, "PNG", 0, 0, 800, 600);
        
        const response = await fetch(`${API_BASE_URL}/certificates/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                courseId: COURSE_ID,
                studentName: localStorage.getItem('userName'),
                courseName: document.getElementById("courseTitle").textContent,
                certificateCode: uniqueId,
                pdfData: pdf.output('datauristring')
            })
        });

        if (response.ok) {
            pdf.save("Certificate.pdf");
            location.reload(); // Refresh the page to update the button link
        } else {
            alert("Failed to save certificate record.");
        }
    } catch (err) { 
        alert("Error generating certificate"); 
    } finally {
        certBtn.disabled = false;
        certBtn.textContent = "🎓 Claim Certificate";
    }
}

// ====================================================================
// UI RENDERING
// ====================================================================

function renderLessons() {
    const container = document.getElementById("lessonsContainer");
    if (!container) return;
    container.innerHTML = "";
    lessons.forEach((l, idx) => {
        const div = document.createElement("div");
        div.className = "lesson-item";
        div.dataset.id = l._id; 
        div.innerHTML = `<div class="status-indicator"></div> <span>${idx + 1}. ${l.title}</span>`;
        div.onclick = () => loadLesson(l._id);
        container.appendChild(div);
    });
}

function loadLesson(lessonId) {
    const lesson = getLessonById(lessonId);
    if (!lesson) return;
    currentLessonId = lessonId;
    document.getElementById("lessonTitle").textContent = lesson.title;
    document.getElementById("videoFrame").src = lesson.videoUrl || "";
    highlightLessons();
    updateMarkButton();
}

function highlightLessons() {
    document.querySelectorAll(".lesson-item").forEach((el) => {
        el.classList.toggle("completed", userCompleted.includes(String(el.dataset.id)));
        el.classList.toggle("active", el.dataset.id === currentLessonId);
    });
}

function updateMarkButton() {
    const btn = document.getElementById("markCompleteBtn");
    if (!btn) return;
    const isDone = userCompleted.includes(String(currentLessonId));
    btn.textContent = isDone ? "✓ Lesson Completed" : "Mark Lesson Complete";
    btn.style.background = isDone ? "#10b981" : "#0b3d91";
}

function updateProgressUI(percent) {
    const display = document.getElementById("progressPercentDisplay");
    const bar = document.getElementById("courseProgressBar");
    if (display) display.textContent = `${Math.round(percent)}%`;
    if (bar) bar.style.width = `${Math.round(percent)}%`;
}

// Initialize on Load
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("markCompleteBtn")?.addEventListener("click", toggleMarkComplete);
    loadCourseData();
});