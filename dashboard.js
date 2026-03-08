// dashboard.js – Express/MongoDB powered dashboard
const API_BASE_URL = 'https://lms-final-prod.onrender.com/api';

// A "Data URI" placeholder: A small grey square encoded as text. 
const fallbackImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function getToken() {
    return localStorage.getItem('token');
}

// ----------------------------------------------
// CORE LOAD FUNCTION
// ----------------------------------------------
async function loadDashboardData() {
    const token = getToken();
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const userRes = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const userData = await userRes.json();

        if (!userRes.ok) {
            localStorage.removeItem('token');
            window.location.href = "login.html";
            return;
        }

        document.getElementById("userDisplay").textContent = userData.user.name || "Learner";

        // Load content
        loadAnnouncements(token);
        loadUserCertificates(token); // Load this BEFORE courses so we can check pass status
        loadCoursesAndProgress(token, userData.user); 
        
    } catch (error) {
        console.error("Dashboard core data error:", error);
    }
}

// ----------------------------------------------
// LOAD ANNOUNCEMENTS
// ----------------------------------------------
async function loadAnnouncements(token) {
    const list = document.getElementById("annList");
    if (!list) return;

    try {
        const res = await fetch(`${API_BASE_URL}/announcements`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const announcements = await res.json();
        if (!res.ok) throw new Error('Fetch failed');

        list.innerHTML = "";
        if (!announcements || announcements.length === 0) {
            list.innerHTML = "<p class='small'>No announcements yet.</p>";
            return;
        }
        
        announcements.slice(0, 5).forEach((a) => {
            const div = document.createElement("div");
            div.className = "announcement-item";
            div.style.padding = "12px 0";
            div.style.borderBottom = "1px solid #f1f5f9";

            const time = a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "Recent";

            div.innerHTML = `
                <h4 style="margin:0; color:#0b3d91; font-size: 0.95rem;">📣 ${a.title}</h4>
                <p style="font-size: 0.85em; margin: 4px 0; color: #475569;">${a.body || a.message}</p>
                <small style="color: #94a3b8; font-size: 0.75rem;">${time}</small>
            `;
            list.appendChild(div);
        });
    } catch (err) {
        list.innerHTML = "<p class='small'>No recent announcements.</p>";
    }
}

// ----------------------------------------------
// LOAD COURSES & PROGRESS
// ----------------------------------------------
async function loadCoursesAndProgress(token, user) {
    const listContainer = document.getElementById("courses-list");
    if (!listContainer) return;

    try {
        const coursesRes = await fetch(`${API_BASE_URL}/courses`);
        const courses = await coursesRes.json();
        if (!coursesRes.ok) throw new Error("Could not fetch courses.");

        listContainer.innerHTML = "";
        let highestProgress = -1;
        let continueCourse = null;

        courses.forEach(course => {
            let percent = 0;
            if (user.progress) {
                // Support both Map and Object structures
                percent = (user.progress[course._id] !== undefined) 
                    ? user.progress[course._id] 
                    : (user.progress.get ? user.progress.get(course._id) : 0);
            }
            
            // Logic to pick the "Continue" course (highest progress but not finished)
            if (percent > 0 && percent < 100 && percent > highestProgress) {
                highestProgress = percent;
                continueCourse = { id: course._id, title: course.title, percent: percent };
            }

            const div = document.createElement("div");
            div.className = "course-item-row";
            div.style.cssText = "padding: 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9;";

            const statusColor = percent === 100 ? '#10b981' : (percent > 0 ? '#ffb020' : '#64748b');

            let thumb = course.thumbnail;
            if (!thumb || thumb === 'default-thumbnail.jpg' || thumb === '') {
                thumb = fallbackImage;
            }

            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${thumb}" 
                         onerror="this.onerror=null;this.src='${fallbackImage}';" 
                         style="width:40px; height:40px; border-radius:4px; background-color:#e2e8f0; object-fit:cover;">
                    <div>
                        <h4 style="margin: 0; color: #1e293b; font-size: 0.9rem;">${course.title}</h4>
                        <p style="margin: 0; font-size: 0.75em; color: ${statusColor}; font-weight: 600;">${percent}% Complete</p>
                    </div>
                </div>
                <a href="course-details.html?id=${course._id}" class="btn-view" style="padding: 6px 14px; font-size: 11px; background: #0b3d91; color: white; border-radius: 6px; text-decoration: none; font-weight: 500;">View</a>
            `;
            listContainer.appendChild(div);
        });
        
        // Final fallback: if no progress started, suggest the first course
        if (!continueCourse && courses.length > 0) {
            continueCourse = { id: courses[0]._id, title: courses[0].title, percent: 0 };
        }

        updateContinueCard(continueCourse);

    } catch (error) {
        console.error("Dashboard list error:", error);
    }
}

// ----------------------------------------------
// LOAD USER CERTIFICATES
// ----------------------------------------------
let earnedCertCourseIds = []; // Global tracker for this session

async function loadUserCertificates(token) {
    const certContainer = document.getElementById("certificates-list");
    if (!certContainer) return;

    try {
        const res = await fetch(`${API_BASE_URL}/certificates/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const certs = await res.json();
        if (!res.ok) throw new Error("Could not fetch certificates.");

        if (!certs || certs.length === 0) {
            certContainer.innerHTML = `<p class="small" style="text-align:center; color:#94a3b8;">No certificates earned yet.</p>`;
            return;
        }

        // Store IDs so the "Take Quiz" button can change to "Claimed"
        earnedCertCourseIds = certs.map(c => c.courseId || c.course);

        certContainer.innerHTML = certs.map(cert => `
            <div class="cert-item-row" style="padding: 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; background: #f8fafc; border-radius: 8px; margin-bottom: 8px;">
                <div>
                    <h4 style="margin: 0; color: #1e293b; font-size: 0.85rem;">${cert.courseName || 'Course Certificate'}</h4>
                    <p style="margin: 0; font-size: 0.7em; color: #64748b;">Issued: ${new Date(cert.createdAt).toLocaleDateString()}</p>
                </div>
                <a href="certificate.html?id=${cert.courseId || cert.course}" style="padding: 5px 10px; background: #10b981; color: white; border-radius: 4px; font-size: 0.65rem; text-decoration: none; font-weight: 600;">Download</a>
            </div>
        `).join('');

    } catch (err) {
        console.error("Cert list error:", err);
    }
}

/**
 * Updates the Hero Card and the Orange Quiz Button
 */
function updateContinueCard(continueCourse) {
    const titleEl = document.getElementById("continueCourseTitle");
    const progPercentEl = document.getElementById("progPercent");
    const progressBarEl = document.getElementById("mainProgress");
    const continueBtnEl = document.getElementById("continueCourseBtn");
    const quizBtnEl = document.getElementById("dashboardQuizBtn"); 

    if (!continueCourse) return;

    titleEl.textContent = continueCourse.title;
    progPercentEl.textContent = `${continueCourse.percent}%`;
    progressBarEl.style.width = `${continueCourse.percent}%`;
    
    continueBtnEl.disabled = false;
    continueBtnEl.onclick = () => window.location.href = `course-details.html?id=${continueCourse.id}`;

    // CHECK: Has the user already earned a certificate for this course?
    if (earnedCertCourseIds.includes(continueCourse.id)) {
        quizBtnEl.textContent = "View Certificate";
        quizBtnEl.style.background = "#10b981"; // Change to green
        quizBtnEl.onclick = () => window.location.href = `certificate.html?id=${continueCourse.id}`;
    } else {
        quizBtnEl.textContent = "Take Quiz";
        quizBtnEl.onclick = () => window.location.href = `quiz.html?id=${continueCourse.id}`;
    }
}

document.addEventListener("DOMContentLoaded", loadDashboardData);

// Logout logic
document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    window.location.href = "login.html";
});