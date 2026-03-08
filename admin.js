// admin.js — Full Admin functionality: announcements + courses + users + certs + Live Classes
const ADMIN_API_URL = 'http://localhost:5001/api';

// --- Buffers for Course Creation ---
let lessonsBuffer = [];
let questionsBuffer = []; 

// --- Helper Functions ---

function getToken() {
    return localStorage.getItem('token');
}

/**
 * FIX: Converts YouTube watch links to Embed links
 */
function convertToYouTubeEmbed(url) {
    if (!url) return url;
    if (url.includes("youtube.com/embed/")) return url;
    
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    
    if (match && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2].trim()}`;
    }
    return url;
}

async function ensureAdminAccess() {
    const token = getToken();
    const contentWrapper = document.getElementById("adminContentWrapper");
    
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const res = await fetch(`${ADMIN_API_URL}/auth/me`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Handle case where server might return HTML error instead of JSON
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            console.error("Server did not return JSON for auth check");
            window.location.href = "login.html";
            return;
        }

        const data = await res.json();

        if (res.ok && data.user.role === 'admin') {
            if (contentWrapper) {
                contentWrapper.style.display = 'block';
            }
            loadAdminCourses();
            loadAnnouncements();
            loadUsers();
            loadCertificates();
            return;
        } else {
            alert("Access denied: This page is for administrators only.");
            window.location.href = "dashboard.html";
            return;
        }
    } catch (err) {
        console.error("Admin access check failed:", err);
        window.location.href = "login.html";
    }
}

ensureAdminAccess();

// ====================================================================
// --- Course Management (LOAD & DELETE) ---
// ====================================================================

async function loadAdminCourses() {
    const listEl = document.getElementById("adminCoursesList");
    if (!listEl) return;

    listEl.innerHTML = "<p>Loading courses...</p>";

    try {
        const res = await fetch(`${ADMIN_API_URL}/courses`);
        const courses = await res.json();

        if (res.ok && Array.isArray(courses)) {
            if (courses.length === 0) {
                listEl.innerHTML = "<p>No courses found.</p>";
                return;
            }

            listEl.innerHTML = "";
            courses.forEach(course => {
                const div = document.createElement("div");
                div.className = "item-box";
                div.innerHTML = `
                    <button class="delete-btn" data-id="${course._id}" style="background:#dc3545; float:right;">Delete</button>
                    <strong>${course.title}</strong><br>
                    <small>${course.lessons ? course.lessons.length : 0} Lessons | $${course.price}</small><br>
                    <small style="color:${course.liveLink ? '#28a745' : '#6c757d'}">
                        ${course.liveLink ? '🔴 Live Class Configured' : '⚪ No Live Class'}
                    </small>
                `;
                listEl.appendChild(div);
            });

            listEl.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', handleDeleteCourse);
            });
        }
    } catch (error) {
        listEl.innerHTML = "<p style='color: red;'>Error loading courses.</p>";
    }
}

async function handleDeleteCourse(event) {
    const id = event.target.dataset.id;
    if (!confirm("Are you sure? All user progress and certificates for this course will be affected.")) return;

    const token = getToken();
    try {
        const res = await fetch(`${ADMIN_API_URL}/courses/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            alert("Course deleted successfully");
            loadAdminCourses();
        }
    } catch (error) {
        alert("Network error.");
    }
}

// ====================================================================
// --- Course & Quiz Builder ---
// ====================================================================

function renderLessonsBuffer() {
    const list = document.getElementById("lessonsList");
    if (!list) return;
    list.innerHTML = "";
    
    if (lessonsBuffer.length === 0) {
        list.innerHTML = "No lessons added yet.";
        return;
    }

    lessonsBuffer.forEach((ls, idx) => {
        const div = document.createElement("div");
        div.className = "item-box";
        div.innerHTML = `
            <button class="delete-btn removeLessonBtn" data-idx="${idx}" style="background:#666;">Remove</button>
            <strong>${idx+1}. ${ls.title}</strong>
            <div style="font-size:11px;color:#007bff">Video URL: ${ls.videoUrl}</div>
        `;
        list.appendChild(div);
    });

    list.querySelectorAll(".removeLessonBtn").forEach(btn => {
        btn.addEventListener("click", () => {
            lessonsBuffer.splice(Number(btn.dataset.idx), 1);
            lessonsBuffer = lessonsBuffer.map((l, i) => ({ ...l, lessonOrder: i + 1 }));
            renderLessonsBuffer();
        });
    });
}

if (document.getElementById("addLessonBtn")) {
    document.getElementById("addLessonBtn").addEventListener("click", () => {
        const t = (document.getElementById("lessonTitleInput").value || "").trim();
        let v = (document.getElementById("lessonVideoInput").value || "").trim(); 
        
        if (!t || !v) return alert("Lesson title & video required");
        
        v = convertToYouTubeEmbed(v);

        lessonsBuffer.push({ 
            title: t, 
            videoUrl: v, 
            content: t, 
            lessonOrder: lessonsBuffer.length + 1 
        }); 

        document.getElementById("lessonTitleInput").value = "";
        document.getElementById("lessonVideoInput").value = "";
        renderLessonsBuffer();
    });
}

function renderQuestionsBuffer() {
    const qList = document.getElementById("quizQuestionsList");
    if (!qList) return;

    if (questionsBuffer.length === 0) {
        qList.innerHTML = "No questions added yet.";
        return;
    }

    qList.innerHTML = questionsBuffer.map((q, idx) => `
        <div class="item-box quiz-preview-box" style="border-left: 4px solid #f39c12;">
            <button class="delete-btn removeQuestionBtn" data-idx="${idx}" style="background:#666;">Delete</button>
            <strong>Q${idx+1}: ${q.questionText}</strong><br>
            <small>Options: ${q.options.join(' | ')}</small><br>
            <small style="color: green;">Correct Index: ${q.correctAnswerIndex}</small>
        </div>
    `).join('');
    
    qList.querySelectorAll(".removeQuestionBtn").forEach(btn => {
        btn.addEventListener("click", () => {
            questionsBuffer.splice(Number(btn.dataset.idx), 1);
            renderQuestionsBuffer();
        });
    });
}

if (document.getElementById("addQuestionBtn")) {
    document.getElementById("addQuestionBtn").addEventListener("click", () => {
        const qText = (document.getElementById("quizQuestionInput").value || "").trim();
        const o0 = document.getElementById("opt0").value.trim();
        const o1 = document.getElementById("opt1").value.trim();
        const o2 = document.getElementById("opt2").value.trim();
        const o3 = document.getElementById("opt3").value.trim();
        const correctIdx = document.getElementById("correctOptIndex").value;

        if (!qText || !o0 || !o1 || !o2 || !o3 || correctIdx === "") {
            return alert("Fill in the question, all 4 options, and select the correct answer!");
        }

        questionsBuffer.push({ 
            questionText: qText, 
            options: [o0, o1, o2, o3], 
            correctAnswerIndex: parseInt(correctIdx) 
        });

        document.getElementById("quizQuestionInput").value = "";
        document.getElementById("opt0").value = ""; document.getElementById("opt1").value = "";
        document.getElementById("opt2").value = ""; document.getElementById("opt3").value = "";
        document.getElementById("correctOptIndex").selectedIndex = 0;

        renderQuestionsBuffer();
    });
}

if (document.getElementById("saveCourseBtn")) {
    document.getElementById("saveCourseBtn").addEventListener("click", async () => {
        const token = getToken();
        const title = (document.getElementById("courseTitle").value || "").trim();
        const category = document.getElementById("courseCategory").value;
        const thumbnail = (document.getElementById("courseThumbnail").value || "").trim();
        const description = (document.getElementById("courseDescription").value || "").trim();
        const liveLink = (document.getElementById("courseLiveLink").value || "").trim();
        const price = Number(document.getElementById("coursePrice").value || 0);

        if (!title || lessonsBuffer.length === 0) {
            return alert("Course Title and at least one lesson are required!");
        }

        const payload = { 
            title, 
            category,
            thumbnail, 
            description, 
            price, 
            liveLink,
            lessons: lessonsBuffer, 
            quiz: questionsBuffer
        };
        
        try {
            const res = await fetch(`${ADMIN_API_URL}/courses`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(payload),
            });
            
            if (res.ok) {
                alert("Course Published Successfully!");
                location.reload();
            } else {
                const data = await res.json();
                alert("Failed to save: " + (data.message || "Error"));
            }
        } catch (error) { 
            alert('Network error. Check backend connection.'); 
        }
    });
}

// ====================================================================
// --- Announcement Management ---
// ====================================================================

if (document.getElementById("announcement-form")) {
    document.getElementById("announcement-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const token = getToken();
        const title = document.getElementById("announcement-title").value;
        const body = document.getElementById("announcement-body").value;

        try {
            const res = await fetch(`${ADMIN_API_URL}/announcements`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ title, body })
            });
            if (res.ok) {
                alert("Announcement Posted!");
                document.getElementById("announcement-form").reset();
                loadAnnouncements();
            }
        } catch (err) { alert("Error posting announcement"); }
    });
}

async function handleDeleteAnnouncement(event) {
    if (!confirm("Delete this announcement?")) return;
    const id = event.target.dataset.id;
    const token = getToken();

    try {
        const res = await fetch(`${ADMIN_API_URL}/announcements/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) { loadAnnouncements(); }
    } catch (error) { console.error(error); }
}

async function loadAnnouncements() {
    const listEl = document.getElementById("activeAnnouncementsList");
    if (!listEl) return;

    try {
        const res = await fetch(`${ADMIN_API_URL}/announcements`);
        const announcements = await res.json();

        if (res.ok && Array.isArray(announcements)) {
            listEl.innerHTML = "";
            announcements.forEach(ann => {
                const div = document.createElement("div");
                div.className = "item-box";
                div.innerHTML = `
                    <button class="delete-btn" data-id="${ann._id}" style="background:#dc3545; float:right;">Delete</button>
                    <strong>${ann.title}</strong> 
                    <div style="font-size: 13px; margin-top:5px;">${ann.body || ann.message}</div>
                `;
                listEl.appendChild(div);
            });
            listEl.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDeleteAnnouncement));
        }
    } catch (error) { console.error(error); }
}

// ====================================================================
// --- Data Listing (Users & Certificates) ---
// ====================================================================

async function loadUsers() {
    const listEl = document.getElementById("userList");
    if (!listEl) return;
    try {
        const res = await fetch(`${ADMIN_API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        // Prevention of SyntaxError: Check if the response is JSON
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Received non-JSON response from /api/users");
        }

        const users = await res.json();
        if (res.ok) {
            listEl.innerHTML = users.map(u => `
                <div class="item-box">
                    <strong>${u.name}</strong> (${u.role.toUpperCase()})<br><small>${u.email}</small>
                </div>
            `).join('');
        }
    } catch (e) { 
        console.error("User Load Error:", e);
        listEl.innerHTML = `<p style="color:red">Error loading users. Route might be missing.</p>`;
    }
}

async function loadCertificates() {
    const tableBody = document.getElementById("certTableBody");
    if (!tableBody) return;
    try {
        const res = await fetch(`${ADMIN_API_URL}/certificates/all`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Received non-JSON response from /api/certificates/all");
        }

        const certs = await res.json();
        if (res.ok) {
            if (certs.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No certificates issued yet.</td></tr>`;
                return;
            }
            tableBody.innerHTML = certs.map(c => `
                <tr>
                    <td><strong>${c.studentName || 'Unknown User'}</strong></td>
                    <td>${c.courseName || 'General Course'}</td>
                    <td>${new Date(c.issuedAt || c.createdAt).toLocaleDateString()}</td>
                </tr>
            `).join('');
        }
    } catch (e) { 
        console.error("Certificate Load Error:", e);
        tableBody.innerHTML = `<tr><td colspan="3" style="color:red;">Error loading certificates. Route might be missing.</td></tr>`;
    }
}

// ====================================================================
// --- EXTRA TOOLS (Wipe Database) ---
// ====================================================================
const clearDbBtn = document.getElementById("clearAllCoursesBtn");
if (clearDbBtn) {
    clearDbBtn.addEventListener("click", async () => {
        if (!confirm("DANGER: This will delete ALL courses and RESET all student progress. Continue?")) return;
        
        try {
            const res = await fetch(`${ADMIN_API_URL}/users/admin/clear-all-courses`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const data = await res.json();
            alert(data.message);
            location.reload();
        } catch (err) {
            alert("Failed to clear database.");
        }
    });
}

// --- Logout ---
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        window.location.href = "login.html";
    });
}