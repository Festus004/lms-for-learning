// admin.js — admin functionality: announcements + add course with lessons + users listing
import { auth, db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// ensure admin
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  // quick check: user's doc role === admin
  try {
    const uRef = doc(db, "users", user.uid);
    const uSnap = await getDoc(uRef);
    if (!uSnap.exists() || uSnap.data().role !== "admin") {
      alert("Access denied: admin only");
      window.location.href = "dashboard.html";
      return;
    }
    // else admin allowed
  } catch (err) {
    console.error("admin auth check failed", err);
  }
});

// Simple announcements posting (if your old button exists)
if (document.getElementById("postAnnouncement")) {
  document.getElementById("postAnnouncement").addEventListener("click", async () => {
    const title = document.getElementById("announceTitle").value.trim();
    const body  = document.getElementById("announceBody").value.trim();
    if (!title || !body) return alert("Fill title & message");
    await addDoc(collection(db, "announcements"), { title, body, timestamp: serverTimestamp() });
    alert("Posted announcement");
    document.getElementById("announceTitle").value = "";
    document.getElementById("announceBody").value = "";
  });
}

// Course builder: local lessons buffer
const lessonsBuffer = [];

function renderLessonsBuffer() {
  const list = document.getElementById("lessonsList");
  if (!list) return;
  list.innerHTML = "";
  lessonsBuffer.forEach((ls, idx) => {
    const div = document.createElement("div");
    div.className = "item-box";
    div.innerHTML = `<strong>${idx+1}. ${ls.title}</strong><div style="font-size:13px;color:#666">${ls.video}</div>
      <div style="margin-top:6px"><button class="removeLessonBtn" data-idx="${idx}">Remove</button></div>`;
    list.appendChild(div);
  });

  // remove handlers
  list.querySelectorAll(".removeLessonBtn").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      const idx = Number(btn.dataset.idx);
      lessonsBuffer.splice(idx,1);
      renderLessonsBuffer();
    });
  });
}

if (document.getElementById("addLessonBtn")) {
  document.getElementById("addLessonBtn").addEventListener("click", (e)=>{
    const t = (document.getElementById("lessonTitleInput").value || "").trim();
    const v = (document.getElementById("lessonVideoInput").value || "").trim();
    if (!t || !v) return alert("Lesson title & video required");
    lessonsBuffer.push({ title: t, video: v, order: lessonsBuffer.length+1 });
    document.getElementById("lessonTitleInput").value = "";
    document.getElementById("lessonVideoInput").value = "";
    renderLessonsBuffer();
  });
}

if (document.getElementById("saveCourseBtn")) {
  document.getElementById("saveCourseBtn").addEventListener("click", async () => {
    const title = (document.getElementById("courseTitle").value || "").trim();
    const description = (document.getElementById("courseDescription").value || "").trim();
    const thumbnail = (document.getElementById("courseThumbnail").value || "").trim();
    if (!title || lessonsBuffer.length === 0) return alert("Course must have title and at least one lesson");
    // prepare object
    const payload = {
      title,
      description,
      thumbnail: thumbnail || "",
      lessons: lessonsBuffer,
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, "courses"), payload);
    alert("Course created");
    // clear UI
    document.getElementById("courseTitle").value = "";
    document.getElementById("courseDescription").value = "";
    document.getElementById("courseThumbnail").value = "";
    lessonsBuffer.length = 0;
    renderLessonsBuffer();
  });
}

// user/cert lists (optional)
async function loadUsers() {
  const list = document.getElementById("userList");
  if (!list) return;
  list.innerHTML = "Loading users…";
  try {
    const res = await getDocs(collection(db, "users"));
    list.innerHTML = "";
    res.forEach(docSnap => {
      const d = docSnap.data();
      const container = document.createElement("div");
      container.className = "item-box";
      container.innerHTML = `<strong>${d.name||'Unnamed'}</strong> <div class="small">${d.email||''}</div><div>Role: ${d.role||'student'}</div>`;
      list.appendChild(container);
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = "<p>Error loading users.</p>";
  }
}
loadUsers();

// certificates listing
async function loadCertificates() {
  const el = document.getElementById("certList");
  if (!el) return;
  el.innerHTML = "Loading certificates…";
  try {
    const res = await getDocs(collection(db, "certificates"));
    el.innerHTML = "";
    res.forEach(docSnap => {
      const c = docSnap.data();
      const div = document.createElement("div");
      div.className = "item-box";
      div.innerHTML = `<strong>${c.studentName||''}</strong><div class="small">${c.courseName||''} • ${c.date||''}</div><div><a href="${c.qrUrl}" target="_blank">View QR</a></div>`;
      el.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    el.innerHTML = "<p>Error loading certificates.</p>";
  }
}
loadCertificates();

// logout binding (if logoutBtn exists)
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) logoutBtn.addEventListener("click", () => signOut(auth));
