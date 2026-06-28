import { appendChatMessage, loadChatHistory } from './js/chat.js';
import { testLiveFlightSearch } from './js/flights.js';
import { updateNavUI, submitAuthForm, toggleAuthMode } from './js/auth.js';
import { toggleDrawer } from './js/ui.js';

// ==========================================
// 1. CUSTOM NOTIFICATIONS (TOASTS)
// ==========================================
function showNotification(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const variantClass = type === 'success' ? 'toast-success' : 'toast-error';
    const icon = type === 'success' ? '✅' : '⚠️';

    toast.className = `toast ${variantClass}`;
    toast.innerHTML = `
        <span>${icon}</span>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="toast-close">&times;</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// 2. GLOBAL STATE & SETUP
// ==========================================
let isLoginMode = true;
let flightContext = "";
const API_BASE_URL = 'http://localhost:5500';

window.toggleDrawer = toggleDrawer;
window.submitAuthForm = submitAuthForm;
window.toggleAuthMode = toggleAuthMode;
window.closeAuthModal = () => document.getElementById("authModal").classList.add("hidden");
window.openAuthModal = () => document.getElementById("authModal").classList.remove("hidden");

// ==========================================
// 3. UI INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    updateNavUI();
    loadChatHistory();

    const sendBtn = document.getElementById("sendBtn");
    const userInput = document.getElementById("userInput");
    const destinationCards = document.querySelectorAll('.destination-card');

    function handleSend() {
        const prompt = userInput.value;
        if (prompt.trim() !== "") {
            appendChatMessage(prompt, "user");
            userInput.value = "";
            testLiveFlightSearch(prompt);
        }
    }

    if (sendBtn) sendBtn.addEventListener("click", handleSend);
    if (userInput) {
        userInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") handleSend();
        });
    }

    // New: Handle destination card clicks from PR
    destinationCards.forEach((card) => {
        card.addEventListener('click', () => {
            const prompt = card.dataset.prompt || card.querySelector('.city')?.textContent || '';
            userInput.value = prompt;
            handleSend();
        });
    });
});