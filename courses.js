// courses.js - Fetch and display all courses with Live Class support and Admin check
const API_BASE_URL = 'https://lms-final-prod.onrender.com/api';

// A "Data URI" placeholder: A small grey square encoded as text. 
// No internet or local files required!
const fallbackImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/**
 * Renders a course card based on the course data.
 */
function createCourseCard(course) {
    const courseId = course._id; 

    // Handle price display
    const priceDisplay = course.price > 0 
        ? `$${Number(course.price).toFixed(2)}` 
        : 'FREE';
    
    // Count lessons
    const lessonCount = course.lessons ? course.lessons.length : 0;
    
    // FIX: Intercept the broken "default-thumbnail.jpg" or missing images
    let imageSrc = course.thumbnail;
    if (!imageSrc || imageSrc === 'default-thumbnail.jpg' || imageSrc === 'hero.png' || imageSrc === '') {
        imageSrc = fallbackImage;
    }

    // Check if course has a live link to show a red badge
    const liveBadge = (course.liveLink && course.liveLink.trim() !== "") 
        ? `<div class="live-badge" style="position: absolute; top: 10px; right: 10px; background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; z-index: 10;">🔴 LIVE</div>` 
        : "";

    return `
        <article class="course-card" data-id="${courseId}" style="position: relative; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff; transition: transform 0.2s;">
            ${liveBadge}
            <img src="${imageSrc}" 
                 alt="${course.title}" 
                 style="background-color: #f1f5f9; height: 160px; object-fit: cover; width: 100%; display: block;"
                 onerror="this.onerror=null; this.src='${fallbackImage}';">
            
            <div style="padding: 15px;">
                <h3 style="margin-top: 0; color: #1e293b; font-size: 1.1rem;">${course.title}</h3>
                <p style="color: #64748b; font-size: 0.85rem; height: 40px; overflow: hidden;">${course.description ? course.description.substring(0, 90) + '...' : 'Join this course to enhance your skills.'}</p>
                
                <div class="course-info">
                    <span class="info-tag" style="color: #94a3b8; font-size: 12px; display: block; margin-bottom: 5px;">
                        📚 ${lessonCount} Lesson(s)
                    </span>
                    
                    ${(course.quiz && course.quiz.length > 0) || course.quizPage ? `
                        <span class="info-tag" style="color: #10b981; font-size: 12px; display: block; margin-bottom: 5px;">
                            📝 Quiz Included
                        </span>
                    ` : ''}

                    <span class="price-tag" style="display: block; margin-bottom: 12px; font-weight: bold; color: #4ade80;">${priceDisplay}</span>
                </div>

                <a href="course-details.html?id=${courseId}" class="btn" style="display: block; text-align: center; background: #0b3d91; color: white; padding: 10px; border-radius: 8px; text-decoration: none; font-weight: 500;">View Details</a>
            </div>
        </article>
    `;
}

/**
 * Fetches all courses from the Express API and displays them.
 */
async function loadCourses() {
    const coursesListElement = document.getElementById('courses-list');
    
    if (!coursesListElement) {
        console.error("Course list container (id='courses-list') not found!");
        return;
    }

    try {
        // Show loading state
        coursesListElement.innerHTML = `
            <div style="text-align: center; grid-column: 1/-1; padding: 40px;">
                <p>Loading your courses...</p>
            </div>`;
        
        const res = await fetch(`${API_BASE_URL}/courses`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const courses = await res.json(); 

        if (!res.ok) {
            throw new Error(courses.message || 'Failed to fetch courses from server.');
        }
        
        if (courses.length === 0) {
            coursesListElement.innerHTML = `
                <div style="text-align: center; grid-column: 1/-1; padding: 40px;">
                    <p class="empty-message">No courses found yet. Check back soon!</p>
                </div>`;
            return;
        }

        let coursesHtml = '';
        courses.forEach(course => {
            coursesHtml += createCourseCard(course); 
        });

        coursesListElement.innerHTML = coursesHtml;

    } catch (error) {
        console.error("Error loading courses:", error);
        coursesListElement.innerHTML = `
            <div style="text-align: center; grid-column: 1/-1; padding: 40px; color: #ef4444;">
                <p class="error-message">⚠️ Failed to load courses. Please try again in a moment.</p>
                <p style="font-size: 12px;">(${error.message})</p>
            </div>`;
    }
}

/**
 * Check if the user is an admin and show the Admin Panel button if they are.
 */
async function checkAdminVisibility() {
    const token = localStorage.getItem('token');
    const adminLinkContainer = document.getElementById("admin-link-container");

    if (!token || !adminLinkContainer) {
        if (adminLinkContainer) adminLinkContainer.style.display = "none";
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok && data.user && data.user.role === 'admin') {
            adminLinkContainer.style.display = "block";
            adminLinkContainer.innerHTML = `<a href="admin.html" class="btn" style="background:#0b3d91;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-size:14px;">Admin Panel</a>`;
        } else {
            adminLinkContainer.style.display = "none";
        }
    } catch (err) {
        console.error("Admin check failed:", err);
        adminLinkContainer.style.display = "none";
    }
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadCourses();
    checkAdminVisibility();
});