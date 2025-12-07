// dashboard.js – Firebase powered dashboard
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";


// ----------------------------------------------
// LOAD USER DASHBOARD DATA
// ----------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) return;

  const userData = snap.data();

  // USER NAME
  document.getElementById("userDisplay").textContent = userData.name || "Learner";

  // PROGRESS (webdev)
  const progress = userData.progress?.webdev || 0;
  document.getElementById("mainProgress").style.width = progress + "%";
  document.getElementById("progPercent").textContent = progress + "%";

  loadAnnouncements();
  loadRecommendedCourses();
});


// ----------------------------------------------
// LOAD ANNOUNCEMENTS
// ----------------------------------------------
async function loadAnnouncements() {
  const list = document.getElementById("annList");
  list.innerHTML = "<p>Loading...</p>";

  try {
    const q1 = query(
      collection(db, "announcements"),
      orderBy("timestamp", "desc")
    );

    const snap = await getDocs(q1);

    list.innerHTML = "";

    if (snap.empty) {
      list.innerHTML = "<p>No announcements yet.</p>";
      return;
    }

    snap.forEach((docSnap) => {
      const a = docSnap.data();
      const div = document.createElement("div");
      div.className = "announcement-item";

      const time = a.timestamp?.toDate
        ? a.timestamp.toDate().toLocaleString()
        : "No date";

      div.innerHTML = `
        <h4>${a.title}</h4>
        <p>${a.body}</p>
        <small>${time}</small>
      `;

      list.appendChild(div);
    });

  } catch (err) {
    console.error("Announcement loading error:", err);
    list.innerHTML = "<p>Error loading announcements.</p>";
  }
}


// ----------------------------------------------
// LOAD RECOMMENDED COURSES
// ----------------------------------------------
async function loadRecommendedCourses() {
  const container = document.getElementById("recommendedCourses");
  container.innerHTML = "Loading...";

  try {
    const q1 = query(
      collection(db, "courses"),
      orderBy("createdAt", "desc"),
      limit(3)
    );

    const snap = await getDocs(q1);

    container.innerHTML = "";

    if (snap.empty) {
      container.innerHTML = "<p>No recommended courses yet.</p>";
      return;
    }

    snap.forEach((docSnap) => {
      const c = docSnap.data();

      const div = document.createElement("div");
      div.className = "course-item";

      div.innerHTML = `
        <h4>${c.title}</h4>
        <p>${c.description || ""}</p>
        <button onclick="window.location.href='courses.html?id=${docSnap.id}'">Open</button>
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error("Course loading error:", err);
    container.innerHTML = "<p>Error loading courses.</p>";
  }
}
