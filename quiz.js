const API_BASE_URL = 'http://localhost:5001/api';
const COURSE_ID = new URLSearchParams(window.location.search).get('id');
let quizData = [];
let userAnswers = {};

async function loadQuiz() {
    console.log("Loading quiz for Course ID:", COURSE_ID);
    const contentArea = document.getElementById("quizContent");
    const courseNameDisplay = document.getElementById("courseNameDisplay");
    const submitBtn = document.getElementById("submitQuiz");

    if (!COURSE_ID) {
        if (courseNameDisplay) courseNameDisplay.textContent = "Error: No Course ID provided.";
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/courses/${COURSE_ID}`);
        if (!res.ok) throw new Error("Course not found");
        const data = await res.json();
        if (courseNameDisplay) courseNameDisplay.textContent = data.title || "Final Assessment";
        
        // Match the data structure from your Admin Panel
        quizData = data.quiz || [];
        
        if (quizData.length === 0) {
            if (contentArea) contentArea.innerHTML = "<p>No quiz questions available for this course yet.</p>";
            return;
        }
        renderQuiz();
        if (submitBtn) submitBtn.style.display = "inline-block";
    } catch (err) {
        console.error("Error loading quiz:", err);
        if (contentArea) contentArea.innerHTML = "<p style='color:red;'>Failed to load quiz. Please ensure the server is running.</p>";
    }
}

function renderQuiz() {
    const contentArea = document.getElementById("quizContent");
    if (!contentArea) return;
    
    // FIX: Changed q.question to q.questionText to match Admin Panel
    contentArea.innerHTML = quizData.map((q, idx) => `
        <div class="question-card" style="margin-bottom: 25px; padding: 25px; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
            <p style="font-weight: bold; font-size: 1.1rem; margin-bottom: 15px;">${idx + 1}. ${q.questionText || q.question}</p>
            <div class="options-group">
                ${q.options.map((opt, optIdx) => `
                    <label class="option-item" style="display: block; padding: 14px; border: 1px solid #e2e8f0; margin: 10px 0; cursor: pointer; border-radius: 8px; background: white;">
                        <input type="radio" name="q${idx}" value="${optIdx}" onclick="saveAnswer(${idx}, ${optIdx})" style="margin-right: 10px;">
                        ${opt}
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
}

window.saveAnswer = (qIdx, optIdx) => {
    userAnswers[qIdx] = optIdx;
};

async function submitQuiz() {
    const token = localStorage.getItem('token');
    const submitBtn = document.getElementById("submitQuiz");

    if (Object.keys(userAnswers).length < quizData.length) {
        return alert("Please answer all questions before submitting.");
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
    }

    let correctCount = 0;
    quizData.forEach((q, idx) => {
        // FIX: Changed q.correctAnswer to q.correctAnswerIndex to match Admin Panel
        const correctAnswer = q.correctAnswerIndex !== undefined ? q.correctAnswerIndex : q.correctAnswer;
        if (userAnswers[idx] == correctAnswer) {
            correctCount++;
        }
    });

    const score = (correctCount / quizData.length) * 100;
    const passed = score >= 75;

    try {
        console.log("Sending to server:", { score, quizPassed: passed, courseId: COURSE_ID });

        const res = await fetch(`${API_BASE_URL}/certificates/check/${COURSE_ID}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                score: score, 
                quizPassed: passed 
            })
        });

        if (res.ok) {
            showResult(score, passed);
        } else {
            const errorData = await res.json();
            console.error("Server rejected submission:", errorData);
            alert(`Failed to save quiz results: ${errorData.message || 'Unknown Error'}`);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit Assessment";
            }
        }
    } catch (err) {
        console.error("Submission error:", err);
        alert("Server connection failed. Is the backend running on port 5001?");
    }
}

function showResult(score, passed) {
    const quizContentWrapper = document.getElementById("quizContentWrapper");
    const resultArea = document.getElementById("resultArea");
    const scoreText = document.getElementById("scoreText");
    const feedbackText = document.getElementById("feedbackText");
    const certAction = document.getElementById("certAction");

    if (quizContentWrapper) quizContentWrapper.style.display = "none";
    if (resultArea) resultArea.style.display = "block";

    if (scoreText) scoreText.textContent = `Your Score: ${Math.round(score)}%`;
    
    if (feedbackText) {
        feedbackText.textContent = passed 
            ? "Excellent work! You have met the requirements for certification." 
            : "You did not reach the 75% passing score. Please review the course and try again.";
        feedbackText.style.color = passed ? "#065f46" : "#9f1239";
    }

    if (passed && certAction) {
        certAction.style.display = "block";
        const downloadBtn = document.getElementById("downloadCertBtn");
        if (downloadBtn) {
            downloadBtn.onclick = () => {
                window.location.href = `course-details.html?id=${COURSE_ID}`;
            };
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const submitBtn = document.getElementById("submitQuizBtn") || document.getElementById("submitQuiz");
    if (submitBtn) submitBtn.onclick = submitQuiz;
    loadQuiz();
});