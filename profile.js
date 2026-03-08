const API_BASE_URL = 'http://localhost:5001/api';

async function loadProfile() {
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await res.json();

        if (res.ok) {
            // 1. Fill in basic info
            document.getElementById('profileName').textContent = data.user.name;
            document.getElementById('profileEmail').textContent = data.user.email;
            
            // 2. Format the date (Member Since)
            const date = new Date(data.user.createdAt);
            document.getElementById('joinedDate').textContent = date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // 3. Handle Progress Logic (FIXED: Calculates average if progress is an object)
            let progress = 0;
            const userProgress = data.user.progress;

            if (userProgress && typeof userProgress === 'object') {
                const values = Object.values(userProgress);
                if (values.length > 0) {
                    const sum = values.reduce((acc, val) => acc + (Number(val) || 0), 0);
                    progress = Math.round(sum / values.length);
                }
            } else {
                progress = Number(userProgress) || 0;
            }

            updateProgressBar(progress);

        } else {
            console.error("Failed to fetch profile:", data.message);
            // If token is expired or invalid, logout
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

function updateProgressBar(percent) {
    const bar = document.getElementById('profileProgressBar');
    const text = document.getElementById('progPercent');
    
    if (bar && text) {
        bar.style.width = percent + '%';
        text.textContent = percent + '%';
    }
}

// Initial Load
loadProfile();