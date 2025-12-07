import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
    // If user is not logged in → block access
    if (!user) {
        alert("You must be logged in as admin.");
        window.location.href = "login.html";
        return;
    }

    // Fetch user role
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        alert("No user profile found.");
        window.location.href = "login.html";
        return;
    }

    const role = userSnap.data().role;

    // If not admin → block access
    if (role !== "admin") {
        alert("Access denied. Admins only.");
        window.location.href = "dashboard.html";
        return;
    }

    console.log("Admin verified ✔");
});
