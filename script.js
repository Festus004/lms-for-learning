// script.js — Firebase-powered LMS FOR LEARNING
// All imports MUST be at top
import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  deleteDoc,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";

// ---------------- Configuration ----------------
const BACKEND_CERT_URL = "http://localhost:3000/api/send-certificate"; // fallback REST backend
// Course IDs / names (you asked to rename — edit here to change)
const COURSES = {
  web_development: "Web Development",
  data_structures: "Data Structures"
};

// ---------------- Utilities ----------------
function safeGet(id){ return document.getElementById(id); }
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return document.querySelectorAll(sel); }

// ---------------- Dark mode ----------------
function toggleDarkMode(){
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("lms_dark", isDark ? "1" : "0");
}
function restoreDarkMode(){
  if (localStorage.getItem("lms_dark") === "1") document.body.classList.add("dark-mode");
}

// ---------------- AUTH (register/login/logout) ----------------

/**
 * registerUser(e)
 * Creates Firebase Auth user and Firestore profile (users/{uid})
 * Keeps function name same as older code so HTML remains compatible.
 */
async function registerUser(e){
  e && e.preventDefault();
  const nameEl = safeGet("regName"), emailEl = safeGet("regEmail"), passEl = safeGet("regPass");
  if (!nameEl || !emailEl || !passEl) return;
  const name = nameEl.value.trim(), email = emailEl.value.trim(), pass = passEl.value;
  if (!name || !email || !pass){ alert("Fill all fields"); return; }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;

    // Save user doc
    await setDoc(doc(db, "users", uid), {
      name,
      email,
      role: "student",
      joined: serverTimestamp(),
      progress: {},
      scores: {}
    });

    // quick local info for UI
    localStorage.setItem("userEmail", email);
    localStorage.setItem("userName", name);

    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("registerUser error:", err);
    alert("Registration failed: " + (err.message || err));
  }
}

/**
 * loginUser(e) - Firebase sign in
 */
async function loginUser(e){
  e && e.preventDefault();
  const emailEl = safeGet("loginEmail"), passEl = safeGet("loginPass");
  if (!emailEl || !passEl) return;
  const email = emailEl.value.trim(), pass = passEl.value;
  if (!email || !pass) { alert("Fill all fields"); return; }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    // sync local storage for UI convenience
    try {
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.name) localStorage.setItem("userName", data.name);
        localStorage.setItem("userEmail", data.email || email);
      }
    } catch (e) { /* ignore */ }

    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("loginUser error:", err);
    alert("Login failed: " + (err.message || err));
  }
}

/**
 * logout()
 */
async function logout(){
  try { await signOut(auth); } catch(e){}
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userName");
  window.location.href = "index.html";
}

// ---------------- Auth state listener (keeps UI synced) ----------------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // attempt to sync name/email from Firestore profile
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        if (d.name) localStorage.setItem("userName", d.name);
        if (d.email) localStorage.setItem("userEmail", d.email);
      }
    } catch (e) { console.warn("auth sync failed", e); }
  }
  // update UI placeholders
  await populateUserUI();
});

// ---------------- populateUserUI() ----------------
async function populateUserUI(){
  // Prefer Firestore profile if user logged in
  const user = auth.currentUser;
  if (user) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (safeGet("userDisplay")) safeGet("userDisplay").textContent = data.name || user.email || "Learner";
        if (safeGet("profileName")) safeGet("profileName").textContent = data.name || "";
        if (safeGet("profileEmail")) safeGet("profileEmail").textContent = data.email || "";
        if (safeGet("joinedDate")) safeGet("joinedDate").textContent = data.joined ? new Date(data.joined.seconds*1000).toLocaleDateString() : "";
        // progress display
        const p = data.progress && data.progress['web_development'] ? data.progress['web_development'] : 0;
        const bar = document.querySelector(".progress-bar"); if (bar) bar.style.width = p + "%";
        if (safeGet("progPercent")) safeGet("progPercent").textContent = p + "%";
        if (safeGet("webDevProgress")) safeGet("webDevProgress").textContent = p;
        return;
      }
    } catch (err) {
      console.warn("populateUserUI firestore read error", err);
    }
  }

  // fallback to localStorage (keeps compatibility)
  const name = localStorage.getItem("userName") || "Learner";
  const email = localStorage.getItem("userEmail") || "";
  if (safeGet("userDisplay")) safeGet("userDisplay").textContent = name;
  if (safeGet("profileName")) safeGet("profileName").textContent = name;
  if (safeGet("profileEmail")) safeGet("profileEmail").textContent = email;
  if (safeGet("joinedDate")){
    const users = JSON.parse(localStorage.getItem("users") || "[]"); const u = users.find(x => x.email === email);
    safeGet("joinedDate").textContent = u ? (new Date(u.joined)).toLocaleDateString() : "";
  }
}

// ---------------- updateProgress() ----------------
async function updateProgress(courseKey, addPercent){
  if (!Object.keys(COURSES).includes(courseKey)) {
    console.warn("Unknown courseKey:", courseKey);
  }

  const user = auth.currentUser;
  if (!user) { alert("Login to save progress"); return; }

  const uRef = doc(db, "users", user.uid);
  try {
    const uSnap = await getDoc(uRef);
    if (!uSnap.exists()) {
      console.warn("User profile missing in Firestore");
      return;
    }
    const data = uSnap.data();
    const progress = data.progress || {};
    progress[courseKey] = Math.min(100, (progress[courseKey] || 0) + Number(addPercent));
    await updateDoc(uRef, { progress });
    await populateUserUI();
    return;
  } catch (err) {
    console.error("updateProgress error", err);
    alert("Could not update progress.");
  }
}

// ---------- QUIZ & Scoring (Firestore-first, robust) ----------
async function submitQuizGeneric(formId, courseKey){
  const form = safeGet(formId);
  if (!form) return;

  // build answers and grade
  const data = new FormData(form);
  let total = 0, score = 0;

  const answerKey = {
    "quizWeb": { q1:"a", q2:"b", q3:"c" },
    "quizDS":  { q1:"b", q2:"a", q3:"b" }
  }[formId] || {};

  for (let pair of data.entries()){
    const name = pair[0], val = pair[1];
    total++;
    if (answerKey[name] && answerKey[name] === val) score++;
  }

  const percent = Math.round((score/Math.max(1,total))*100);

  // Update user's record in Firestore (preferred) with optimistic local fallback
  const currentUser = auth.currentUser;

  try {
    if (currentUser) {
      const uRef = doc(db, "users", currentUser.uid);
      const uSnap = await getDoc(uRef);

      if (!uSnap.exists()) {
        throw new Error("User profile missing (Firestore).");
      }

      const udata = uSnap.data();
      const scores = udata.scores || {};
      scores[formId] = percent;

      const progress = udata.progress || {};
      // rule: pass >= 60 -> +40% else +10%
      const add = (percent >= 60 ? 40 : 10);
      progress[courseKey] = Math.min(100, (progress[courseKey] || 0) + add);

      // Write back atomically
      await updateDoc(uRef, { scores, progress });

      // Re-fetch to get updated progress
      const updated = await getDoc(uRef);
      const prog = updated.exists() ? (updated.data().progress?.[courseKey] || 0) : (progress[courseKey] || 0);

      // Notify user
      alert(`Quiz result: ${score}/${total} — ${percent}%`);

      // If reached 100%, trigger certificate flow
      if (prog >= 100) {
        // get name & email from profile
        const studentName = updated.data().name || currentUser.displayName || "Learner";
        const studentEmail = updated.data().email || currentUser.email;

        try {
          await sendCertificateToStudent(studentName, studentEmail, (typeof COURSES !== 'undefined' && COURSES[courseKey]) ? COURSES[courseKey] : courseKey);
          alert("🎉 Certificate process started — check your email soon.");
        } catch (err) {
          console.error("Certificate send error:", err);
          alert("Certificate generation failed (see console).");
        }

        // redirect to certificate page (keeps courseKey for display)
        window.location.href = `certificate.html?course=${courseKey}`;
        return;
      } else {
        // simply go back to dashboard
        window.location.href = "dashboard.html";
        return;
      }

    } else {
      // No firebase user — fallback to localStorage behavior (keeps compatibility)
      const email = localStorage.getItem("userEmail");
      if (email) {
        const users = getUsersLocal();
        const u = users.find(x => x.email === email);
        if (u) {
          u.scores = u.scores || {}; u.scores[formId] = percent;
          u.progress = u.progress || {};
          u.progress[courseKey] = Math.min(100, (u.progress[courseKey] || 0) + (percent >= 60 ? 40 : 10));
          saveUsersLocal(users);
        }
      }

      alert(`Quiz result: ${score}/${total} — ${percent}%`);
      window.location.href = "dashboard.html";
      return;
    }
  } catch (err) {
    console.error("submitQuizGeneric error:", err);
    alert("Error saving quiz result. Check console for details.");
  }
}


// update Firestore user doc
  const user = auth.currentUser;
  if (!user) {
    // fallback local
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const u = users.find(x => x.email === localStorage.getItem("userEmail"));
    if (u) {
      u.scores = u.scores || {}; u.scores[formId] = percent;
      u.progress = u.progress || {};
      u.progress[courseKey] = Math.min(100, (u.progress[courseKey] || 0) + (percent >= 60 ? 40 : 10));
      localStorage.setItem("users", JSON.stringify(users));
    }
    alert(`Quiz: ${score}/${total} — ${percent}%`);
    populateUserUI();
    window.location.href = "dashboard.html";
    return;
  }

  try {
    const uRef = doc(db, "users", user.uid);
    const uSnap = await getDoc(uRef);
    if (!uSnap.exists()) {
      alert("User profile missing.");
      return;
    }
    const udata = uSnap.data();
    const scores = udata.scores || {}; scores[formId] = percent;
    const progress = udata.progress || {};
    progress[courseKey] = Math.min(100, (progress[courseKey] || 0) + (percent >= 60 ? 40 : 10));
    await updateDoc(uRef, { scores, progress });
  } catch (err) {
    console.error("submitQuizGeneric firestore update error", err);
  }

  alert(`Quiz: ${score}/${total} — ${percent}%`);
  await populateUserUI();

  // get updated progress
  let prog = 0;
  try {
    const s = await getDoc(doc(db, "users", user.uid));
    if (s.exists()) prog = s.data().progress?.[courseKey] || 0;
  } catch(e){ console.warn(e); }

  // certificate flow
  if (prog >= 100) {
    const studentName = (await getDoc(doc(db, "users", user.uid))).data().name || "Learner";
    const studentEmail = (await getDoc(doc(db, "users", user.uid))).data().email || user.email;
    const readableCourseName = COURSES[courseKey] || courseKey;
    try {
      await sendCertificateToStudent(studentName, studentEmail, readableCourseName);
      alert("🎉 Certificate process started — check your email shortly.");
    } catch(err){
      console.error("Certificate sending failed:", err);
      alert("Certificate sending failed (see console).");
    }
    window.location.href = `certificate.html?course=${courseKey}`;
  } else {
    window.location.href = "dashboard.html";
  }

// ---------------- sendCertificateToStudent() (Cloud Function preferred) ----------------
async function sendCertificateToStudent(name, email, course) {
  // prefer Cloud Function named 'sendCertificate'
  try {
    const functions = getFunctions();
    const sendCertFn = httpsCallable(functions, 'sendCertificate');
    const res = await sendCertFn({ name, email, course });
    return res.data;
  } catch (err) {
    console.warn("Cloud Function not available, falling back to REST backend", err);
    // fallback to REST endpoint (if you have node backend running)
    try {
      const r = await fetch(BACKEND_CERT_URL, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ name, email, course })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Backend error");
      return data;
    } catch (err2) {
      console.error("Fallback certificate send failed", err2);
      throw err2;
    }
  }
}

// ---------------- Certificate UI loader ----------------
function loadCertificateFromQuery(){
  const params = new URLSearchParams(location.search);
  const course = params.get("course") || "course";
  const name = localStorage.getItem("userName") || (auth.currentUser ? auth.currentUser.displayName : "Learner");
  const issued = new Date().toLocaleDateString();
  if (safeGet("certName")) safeGet("certName").textContent = name;
  if (safeGet("certCourse")) safeGet("certCourse").textContent = (COURSES[course] || course).toUpperCase();
  if (safeGet("certDate")) safeGet("certDate").textContent = issued;
}

// ---------------- Admin stats & user management ----------------
async function adminStatsPopulate(){
  // ensure admin only calls this (call from admin page which is protected)
  try {
    const snapshot = await getDocs(collection(db, "users"));
    const users = [];
    snapshot.forEach(s => users.push({ id: s.id, ...s.data() }));
    if (safeGet("userCount")) safeGet("userCount").textContent = users.length;
    // average quiz (web_development)
    let sum = 0, count = 0;
    users.forEach(u => {
      if (u.scores && typeof u.scores.quizWeb !== "undefined"){
        sum += Number(u.scores.quizWeb || 0); count++;
      }
    });
    if (safeGet("avgScore")) safeGet("avgScore").textContent = count ? Math.round(sum/count) + "%": "N/A";
    const tbody = safeGet("adminTbody");
    if (tbody){
      tbody.innerHTML = "";
      users.forEach((u,i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${i+1}</td><td>${u.name || ''}</td><td>${u.email || ''}</td><td>${u.joined ? (new Date(u.joined.seconds*1000)).toLocaleDateString() : ''}</td>
          <td><button onclick="adminDeleteUser('${u.id}')">Delete</button></td>`;
        tbody.appendChild(tr);
      });
    }
    return;
  } catch (err) {
    console.error("adminStatsPopulate error", err);
  }
}

// delete user (admin)
async function adminDeleteUser(uid){
  if (!confirm("Delete user?")) return;
  try {
    await deleteDoc(doc(db, "users", uid));
    alert("Deleted");
    adminStatsPopulate();
  } catch (err) {
    console.error("adminDeleteUser error", err);
    alert("Failed to delete user");
  }
}

// ---------------- Announcements (real-time) ----------------
async function postAnnouncement(e){
  e && e.preventDefault();
  const txtTitle = safeGet("annTitle") && safeGet("annTitle").value.trim();
  const txt = safeGet("annText") && safeGet("annText").value.trim();
  if (!txt && !txtTitle){ alert("Write announcement"); return; }

  // check admin role
  const user = auth.currentUser;
  if (!user) { alert("Login as admin to post announcements"); return; }

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists() || userSnap.data().role !== "admin") {
      alert("Only admin can post announcements here. Use admin panel.");
      return;
    }
    await addDoc(collection(db, "announcements"), {
      title: txtTitle || "Announcement",
      message: txt,
      createdAt: serverTimestamp()
    });
    if (safeGet("annTitle")) safeGet("annTitle").value = "";
    if (safeGet("annText")) safeGet("annText").value = "";
  } catch (err) {
    console.error("postAnnouncement error", err);
    alert("Could not post announcement");
  }
}

function renderAnnouncements(){
  const annEl = safeGet("annList");
  if (!annEl) return;

  try {
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
      annEl.innerHTML = "";
      snap.forEach(s => {
        const a = s.data();
        const div = document.createElement("div");
        div.className = "announcement-item";
        const dateText = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().toLocaleString() : a.createdAt) : "";
        div.innerHTML = `<div><small>${dateText}</small></div><div><strong>${a.title || ''}</strong><div>${a.message || a.text || ''}</div></div>`;
        annEl.appendChild(div);
      });
    });
  } catch (err) {
    console.warn("renderAnnouncements error", err);
    // no fallback here — admin panel can manage local announcements if you previously used them
  }
}

// ---------------- Forum & Chat — keep local behavior for now (unchanged) ----------------
function postForum(e){
  e && e.preventDefault();
  const title = safeGet("postTitle") && safeGet("postTitle").value.trim();
  const body = safeGet("postBody") && safeGet("postBody").value.trim();
  if (!title || !body){ alert("Title and body required"); return; }
  const forum = JSON.parse(localStorage.getItem("forum")||"[]");
  forum.unshift({ title, body, author: localStorage.getItem("userName") || "Guest", time: new Date().toISOString() });
  localStorage.setItem("forum", JSON.stringify(forum));
  safeGet("postTitle").value = ""; safeGet("postBody").value = "";
  renderForum();
}
function renderForum(){
  const forum = JSON.parse(localStorage.getItem("forum")||"[]");
  const el = safeGet("forumList"); if (!el) return;
  el.innerHTML = "";
  forum.forEach(p => {
    const div = document.createElement("div");
    div.className = "forum-post";
    div.innerHTML = `<h4>${p.title}</h4><div><small>by ${p.author} • ${new Date(p.time).toLocaleDateString()}</small></div><p>${p.body}</p>`;
    el.appendChild(div);
  });
}

// Chat
function sendChat(){
  const txt = safeGet("chatInput") && safeGet("chatInput").value.trim();
  if (!txt) return;
  const messages = JSON.parse(localStorage.getItem("chat")||"[]");
  messages.push({ author: localStorage.getItem("userName")||"Guest", text: txt, time: new Date().toISOString() });
  localStorage.setItem("chat", JSON.stringify(messages));
  safeGet("chatInput").value = "";
  renderChat();
}
function renderChat(){
  const msgs = JSON.parse(localStorage.getItem("chat")||"[]");
  const el = safeGet("chatWindow"); if (!el) return;
  el.innerHTML = "";
  msgs.forEach(m => {
    const d = document.createElement("div");
    d.innerHTML = `<div><strong>${m.author}</strong> <small style="color:var(--muted)">${new Date(m.time).toLocaleTimeString()}</small></div><div>${m.text}</div>`;
    d.style.padding="6px"; d.style.borderBottom="1px solid #f0f0f0";
    el.appendChild(d);
  });
  el.scrollTop = el.scrollHeight;
}

// ---------------- Init: wire handlers on DOM ready ----------------
document.addEventListener("DOMContentLoaded", function(){
  restoreDarkMode();

  // auth forms
  if (safeGet("registerForm")) safeGet("registerForm").addEventListener("submit", registerUser);
  if (safeGet("loginForm")) safeGet("loginForm").addEventListener("submit", loginUser);

  // quizzes
  if (safeGet("quizForm")) safeGet("quizForm").addEventListener("submit", function(e){ e.preventDefault(); submitQuizGeneric('quizForm','web_development'); });
  if (safeGet("quizWeb")) safeGet("quizWeb").addEventListener("submit", function(e){ e.preventDefault(); submitQuizGeneric('quizWeb','web_development'); });
  if (safeGet("quizDS")) safeGet("quizDS").addEventListener("submit", function(e){ e.preventDefault(); submitQuizGeneric('quizDS','data_structures'); });

  // announcements
  if (safeGet("annForm")) safeGet("annForm").addEventListener("submit", postAnnouncement);
  if (safeGet("annList")) renderAnnouncements();

  // forum
  if (safeGet("forumForm")) safeGet("forumForm").addEventListener("submit", postForum);
  if (safeGet("forumList")) renderForum();

  // chat
  if (safeGet("chatSend")) safeGet("chatSend").addEventListener("click", sendChat);
  if (safeGet("chatWindow")) renderChat();

  // admin area
  if (safeGet("adminTbody") || safeGet("userCount") || safeGet("avgScore")) adminStatsPopulate();

  // certificate page
  if (safeGet("certName") || safeGet("certCourse")) loadCertificateFromQuery();

  // populate user placeholder fields
  populateUserUI();
});

// expose some functions to global scope for inline handlers in HTML if used
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logout = logout;
window.submitQuizGeneric = submitQuizGeneric;
window.updateProgress = updateProgress;
window.postAnnouncement = postAnnouncement;
window.adminDeleteUser = adminDeleteUser;
window.sendCertificateToStudent = sendCertificateToStudent;
