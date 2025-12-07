// course.js – loads single course and handles lesson completion
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// helper to get query param
function qparam(name) {
  return new URLSearchParams(location.search).get(name);
}

let COURSE_ID = qparam("id");
if (!COURSE_ID) {
  document.getElementById("courseTitle").textContent = "Course not specified";
}

let lessons = []; // array of {title, video, order}
let currentLessonIndex = 0;
let userCompleted = []; // lesson indexes user completed

async function loadCourseData() {
  const courseRef = doc(db, "courses", COURSE_ID);
  const snap = await getDoc(courseRef);
  if (!snap.exists()) {
    document.getElementById("courseTitle").textContent = "Course not found";
    document.getElementById("courseDesc").textContent = "";
    return;
  }
  const data = snap.data();
  document.getElementById("courseTitle").textContent = data.title || "Course";
  document.getElementById("courseDesc").textContent = data.description || "";
  lessons = (data.lessons || []).slice().sort((a,b)=> (a.order||0) - (b.order||0));
  renderLessons();
  // default to first lesson
  if (lessons.length) loadLesson(0);
  // quiz link (if exists)
  if (data.quizPage) {
    document.getElementById("quizLink").href = data.quizPage;
  } else {
    document.getElementById("quizLink").href = `#quizSection`;
  }
}

function renderLessons() {
  const container = document.getElementById("lessonsContainer");
  container.innerHTML = "";
  lessons.forEach((l, idx) => {
    const div = document.createElement("div");
    div.className = "lesson-item";
    div.dataset.index = idx;
    div.innerHTML = `
      <div style="width:18px;text-align:center">${idx+1}</div>
      <div class="title">${l.title}</div>
      <div style="margin-left:auto">
        <button class="btn small playBtn" data-idx="${idx}">Play</button>
      </div>
    `;
    container.appendChild(div);
  });

  // attach play buttons
  container.querySelectorAll(".playBtn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = Number(btn.dataset.idx);
      loadLesson(idx);
    });
  });
}

// load a lesson (index)
function loadLesson(index) {
  if (!lessons[index]) return;
  currentLessonIndex = index;
  const lesson = lessons[index];
  document.getElementById("lessonTitle").textContent = lesson.title;
  // embed video (support YouTube links or direct embed)
  const frame = document.getElementById("videoFrame");
  const url = lesson.video || "";
  // If youtube watch link, convert to embed
  let embed = url;
  if (url.includes("youtube.com/watch")) {
    const id = new URL(url).searchParams.get("v");
    embed = `https://www.youtube.com/embed/${id}`;
  } else if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1];
    embed = `https://www.youtube.com/embed/${id}`;
  }
  frame.src = embed;
  highlightLesson(index);
  // update mark button text based on whether user completed
  updateMarkButton();
}

// highlight lesson in list
function highlightLesson(index) {
  document.querySelectorAll(".lesson-item").forEach((el) => el.classList.remove("completed","active"));
  const el = document.querySelector(`.lesson-item[data-index="${index}"]`);
  if (el) el.classList.add("active");
  // mark completed items visually
  document.querySelectorAll(".lesson-item").forEach((el)=>{
    const i = Number(el.dataset.index);
    if (userCompleted.includes(i)) el.classList.add("completed");
    else el.classList.remove("completed");
  });
}

// update mark complete button text
function updateMarkButton() {
  const btn = document.getElementById("markCompleteBtn");
  if (userCompleted.includes(currentLessonIndex)) {
    btn.textContent = "Mark Incomplete";
    btn.style.background = "#b91c1c";
  } else {
    btn.textContent = "Mark Lesson Complete";
    btn.style.background = "#0b3d91";
  }
}

// toggle mark complete (updates Firestore user profile)
async function toggleMarkComplete() {
  const user = auth.currentUser;
  if (!user) { alert("Login to save progress"); return; }
  const uRef = doc(db, "users", user.uid);

  // read current
  const uSnap = await getDoc(uRef);
  if (!uSnap.exists()) {
    alert("User profile missing.");
    return;
  }
  const udata = uSnap.data();
  const completedMap = udata.completedLessons || {}; // object: courseId -> [idx,...]
  const arr = completedMap[COURSE_ID] ? [...completedMap[COURSE_ID]] : [];

  const idx = currentLessonIndex;
  const exists = arr.includes(idx);
  if (exists) {
    // remove
    const newArr = arr.filter(x => x !== idx);
    completedMap[COURSE_ID] = newArr;
  } else {
    // add
    arr.push(idx);
    completedMap[COURSE_ID] = arr;
  }

  // compute percent
  const total = lessons.length || 1;
  const completedCount = (completedMap[COURSE_ID] || []).length;
  const percent = Math.round((completedCount / total) * 100);

  // write back both completedLessons and progress
  const progressObj = udata.progress || {};
  progressObj[COURSE_ID] = percent;

  await updateDoc(uRef, {
    completedLessons: completedMap,
    progress: progressObj
  });

  // update UI local copy
  userCompleted = completedMap[COURSE_ID] || [];
  highlightLesson(currentLessonIndex);
  updateMarkButton();
  document.getElementById("progressBadge").textContent = `Progress: ${percent}%`;
}

// read user's completed lessons then load
onAuthStateChanged(auth, async (user) => {
  if (!COURSE_ID) return;
  if (!user) {
    // not logged in: show 0% badge
    document.getElementById("progressBadge").textContent = `Progress: 0%`;
    return;
  }

  try {
    const uRef = doc(db, "users", user.uid);
    const uSnap = await getDoc(uRef);
    if (!uSnap.exists()) {
      document.getElementById("progressBadge").textContent = `Progress: 0%`;
      return;
    }
    const udata = uSnap.data();
    userCompleted = udata.completedLessons && udata.completedLessons[COURSE_ID] ? udata.completedLessons[COURSE_ID] : [];
    const percent = udata.progress && udata.progress[COURSE_ID] ? udata.progress[COURSE_ID] : 0;
    document.getElementById("progressBadge").textContent = `Progress: ${percent}%`;
    // mark lessons that are completed visually
    highlightLesson(currentLessonIndex);
    updateMarkButton();
  } catch (err) {
    console.error("load user progress error", err);
  }
});

document.getElementById("markCompleteBtn").addEventListener("click", toggleMarkComplete);

// load course on page open
loadCourseData();
