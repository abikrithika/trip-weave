import { appendChatMessage, loadChatHistory } from './js/chat.js';
import { testLiveFlightSearch } from './js/flights.js';
import { updateNavUI, submitAuthForm, toggleAuthMode } from './js/auth.js';
import { toggleDrawer } from './js/ui.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize UI
    updateNavUI();
    loadChatHistory();

    // 2. Chat Input Listeners
    const sendBtn = document.getElementById("sendBtn");
    const userInput = document.getElementById("userInput");

    function handleSend() {
        const prompt = userInput.value;
        if (prompt.trim() !== "") {
            appendChatMessage(prompt, "user", true);
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

    // 3. Auth & UI Listeners (Fixing the onclick issues)
    const authForm = document.getElementById("authForm");
    if (authForm) authForm.addEventListener("submit", submitAuthForm);

    const toggleAuthBtn = document.getElementById("toggleAuthModeBtn");
    if (toggleAuthBtn) toggleAuthBtn.addEventListener("click", toggleAuthMode);

    const drawerBtn = document.getElementById("savedFlightsToggleBtn"); // Ensure this ID matches your HTML
    if (drawerBtn) drawerBtn.addEventListener("click", toggleDrawer);
});