// ui.js

/**
 * 🌙 Toggles the 'dark-mode' class on the document body.
 * This class is then used by CSS to apply dark theme styles.
 */
function toggleDarkMode() {
    // 1. Toggle the 'dark-mode' class on the <body> tag
    document.body.classList.toggle('dark-mode');

    // 2. Save the user's preference to local storage
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');

    // 3. Update the button text (icon)
    const toggleButton = document.querySelector('.toggle-dark');
    if (toggleButton) {
        toggleButton.textContent = isDarkMode ? '☀️' : '🌙';
    }
}

/**
 * Applies the theme saved in local storage when the page loads.
 */
function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        // Update button icon on load
        const toggleButton = document.querySelector('.toggle-dark');
        if (toggleButton) {
            toggleButton.textContent = '☀️';
        }
    }
}

// Run this function when the DOM content is fully loaded
document.addEventListener('DOMContentLoaded', applySavedTheme);