import { appendChatMessage, loadChatHistory } from './js/chat.js';
import { testLiveFlightSearch } from './js/flights.js';
import { updateNavUI, submitAuthForm, toggleAuthMode } from './js/auth.js';
import { toggleDrawer } from './js/ui.js';

// Expose functions to the window for inline HTML onclick attributes
window.toggleDrawer = toggleDrawer;
window.submitAuthForm = submitAuthForm;
window.toggleAuthMode = toggleAuthMode;
window.closeAuthModal = () => document.getElementById("authModal").classList.add("hidden");
window.openAuthModal = () => document.getElementById("authModal").classList.remove("hidden");

document.addEventListener("DOMContentLoaded", () => {
    updateNavUI();
    loadChatHistory();

    const sendBtn = document.getElementById("sendBtn");
    const userInput = document.getElementById("userInput");

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
});