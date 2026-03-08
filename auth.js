// auth.js - Handles client-side authentication by communicating with the Express/MongoDB API
const API_BASE_URL = 'https://lms-final-prod.onrender.com/api';

/**
 * Handles user registration by posting data to the Express API.
 */
async function registerUser(name, email, password) {
    try {
        const res = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();

        if (res.ok) {
            // Save token to localStorage
            localStorage.setItem('token', data.token);
            
            alert('Registration successful! Welcome to your learning journey.');
            
            // Critical: Small delay to ensure the browser finishes writing the token to storage
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
            
            return { success: true };
        } else {
            // Display specific error from backend or a default message
            alert(data.message || data.msg || 'Registration failed. Please try again.');
            return { success: false };
        }
    } catch (error) {
        console.error('Registration API error:', error);
        alert('Could not connect to the server. Please check your internet connection.');
        return { success: false };
    }
}

/**
 * Handles user login by posting data to the Express API.
 */
async function loginUser(email, password) {
    try {
        const res = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (res.ok) {
            // Save token to localStorage
            localStorage.setItem('token', data.token);
            
            // Verification check: Only redirect if token was successfully stored
            if (localStorage.getItem('token')) {
                window.location.href = 'dashboard.html';
            } else {
                // Fallback for rare browser storage lag
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 300);
            }
            return { success: true };
        } else {
            alert(data.message || data.msg || 'Login failed. Please check your credentials.');
            return { success: false };
        }
    } catch (error) {
        console.error('Login API error:', error);
        alert('Could not connect to the authentication server. Please try again later.');
        return { success: false };
    }
}

/**
 * Clears the stored token and redirects to the login page.
 */
function logoutUser() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

// =============================================================
// DOM BINDINGS
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Login Form ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            loginUser(email, password);
        });
    }

    // --- 2. Register Form ---
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            registerUser(name, email, password);
        });
    }

    // --- 3. Logout Button ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutUser();
        });
    }
});