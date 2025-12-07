// firebase.js

// Core Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

// Auth
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Firestore
import { 
  getFirestore,
  doc, setDoc, getDoc, updateDoc, addDoc, collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Storage (for course videos in future)
import {
  getStorage
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyBG7d5gg0FoSTAuppNt28nWc1G3nRkeSIQ",
    authDomain: "lms-for-learning.firebaseapp.com",
    projectId: "lms-for-learning",
    storageBucket: "lms-for-learning.firebasestorage.app",
    messagingSenderId: "802035563184",
    appId: "1:802035563184:web:b419a35dbd43be1f221975",
    measurementId: "G-JHKFX1Q3D2"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
