const API_BASE_URL = 'http://localhost:5001/api';

document.addEventListener("DOMContentLoaded", () => {
    fetchAllCourses();
});

/**
 * Fetches all available courses from the backend and renders them as cards
 */
async function fetchAllCourses() {
    const grid = document.getElementById('course-grid');
    if (!grid) return;

    // Show a loading message while fetching
    grid.innerHTML = '<p class="loading">Discovering courses...</p>';

    try {
        const res = await fetch(`${API_BASE_URL}/courses`);
        const courses = await res.json();

        if (!res.ok) {
            grid.innerHTML = `<p class="error">Error: ${courses.message || 'Could not load courses.'}</p>`;
            return;
        }

        if (courses.length === 0) {
            grid.innerHTML = '<p class="info">No courses are currently available. Check back soon!</p>';
            return;
        }

        // Map through the courses and create the "Advertisable" HTML for each
        grid.innerHTML = courses.map(course => `
            <div class="course-card">
                <div class="card-image" style="background-image: url('${course.thumbnail || 'https://via.placeholder.com/300x160?text=Course+Preview'}')">
                    <span class="badge">${course.category || 'Professional'}</span>
                </div>
                <div class="card-content">
                    <div class="card-meta">
                        <span>⭐ 4.9</span>
                        <span>${course.lessons ? course.lessons.length : 0} Lessons</span>
                    </div>
                    <h3>${course.title}</h3>
                    <p>${course.description ? course.description.substring(0, 90) : 'Learn the core principles and advance your career today.'}...</p>
                    <div class="card-footer">
                        <a href="course-details.html?id=${course._id}" class="enroll-btn">View Course Details</a>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error("Catalog Load Error:", err);
        grid.innerHTML = '<p class="error">Connection failed. Is the server running?</p>';
    }
}