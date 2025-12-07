import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  getIdTokenResult 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/**
 * Register user (role = student)
 */
export async function registerUser(e) {
  e?.preventDefault();

  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const pass = document.getElementById("regPass").value;

  if (!name || !email || !pass) {
    alert("Fill all fields");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;

    // Create user profile in Firestore
    await setDoc(doc(db, "users", uid), {
      name,
      email,
      role: "student",
      joined: serverTimestamp(),
      progress: {},
      scores: {}
    });

    window.location.href = "dashboard.html";

  } catch (err) {
    console.error(err);
    alert("Registration error: " + err.message);
  }
}

/**
 * Login user
 */
export async function loginUser(e) {
  e?.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value;

  if (!email || !pass) {
    alert("Fill all fields");
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);

    // Ensure user exists in Firestore
    const userDoc = await getDoc(doc(db, "users", cred.user.uid));
    if (!userDoc.exists()) {
      alert("User profile missing in database. Contact admin.");
      return;
    }

    window.location.href = "dashboard.html";

  } catch (err) {
    console.error(err);
    alert("Login error: " + err.message);
  }
}

/**
 * Logout
 */
export async function logoutUser() {
  await signOut(auth);
  window.location.href = "index.html";
}

/**
 * Get user + admin claims
 */
export async function getCurrentUserAndClaims() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) return resolve(null);
      const token = await getIdTokenResult(user, true);
      resolve({ user, claims: token.claims });
    });
  });
}
