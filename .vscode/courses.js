// courses.js — loads courses list from Firestore
import { db } from "./firebase.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

async function loadCourses() {
  const container = document.getElementById("courseList");
  container.innerHTML = "<p>Loading courses…</p>";

  try {
    const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    container.innerHTML = "";

    if (snap.empty) {
      container.innerHTML = "<p>No courses published yet.</p>";
      return;
    }

    snap.forEach((docSnap) => {
      const c = docSnap.data();
      const id = docSnap.id;

      const card = document.createElement("article");
      card.className = "course-card";

      card.innerHTML = `
        <img src="${c.thumbnail || 'hero.png'}" alt="${c.title}">
        <h3>${c.title}</h3>
        <p>${c.description || ''}</p>
        <div style="display:flex;gap:8px;align-items:center">
          <a class="btn" href="course.html?id=${id}">View Lessons</a>
          <span style="margin-left:auto;color:#94a3b8;font-size:13px;">${c.lessons ? c.lessons.length : 0} lessons</span>
        </div>
      `;

      container.appendChild(card);
    });

  } catch (err) {
    console.error("loadCourses error:", err);
    container.innerHTML = "<p>Error loading courses.</p>";
  }
}

loadCourses();
