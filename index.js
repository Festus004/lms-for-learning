// index.js - Frontend logic for index.html
const API_URL = 'http://localhost:5001/api/courses/recommended';

async function loadRecommendedCourses() {
    // This assumes you have a div with id="recommendedCourses" in index.html
    const container = document.getElementById('recommendedCourses');
    if (!container) return;

    try {
        const response = await fetch(API_URL);
        const courses = await response.json();

        if (courses.length === 0) {
            container.innerHTML = '<p>No courses recommended yet. Check back later!</p>';
            return;
        }

        // Map through courses and inject HTML
        container.innerHTML = courses.map(course => `
            <div class="course-card">
                <div class="course-info">
                    <h3>${course.title}</h3>
                    <p>${course.description ? course.description.substring(0, 80) : 'Join this course to enhance your skills.'}...</p>
                    
                    <a href="course-details.html?id=${course._id}" class="btn-small">View Course</a>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error loading recommended courses:", error);
        container.innerHTML = '<p>Visit our Courses page to see all available lessons.</p>';
    }
}

// --- AUTHENTICATION UI LOGIC ---

const token = localStorage.getItem('token');
const logoutBtn = document.getElementById('logoutBtn');

// Update Nav visibility based on login status
if (token) {
    // User is logged in: Hide Login/Signup, Show Logout
    const authLinks = document.querySelectorAll('a[href="login.html"], a[href="register.html"]');
    authLinks.forEach(link => link.style.display = 'none');
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
} else {
    // User is logged out: Hide Logout
    if (logoutBtn) logoutBtn.style.display = 'none';
}

// Handle Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        alert('Logged out successfully');
        window.location.href = 'index.html'; // Redirect to home
    });
}

document.addEventListener('DOMContentLoaded', loadRecommendedCourses);