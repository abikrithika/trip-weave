import { appendChatMessage, loadChatHistory } from './js/chat.js';
import { testLiveFlightSearch } from './js/flights.js';
import { updateNavUI, submitAuthForm, toggleAuthMode } from './js/auth.js';
import { toggleDrawer } from './js/ui.js';
import { saveFlight, loadSavedFlights, deleteSavedFlight } from './save-flights.js';

// Expose functions for HTML onclick handlers
window.toggleDrawer = toggleDrawer;
window.submitAuthForm = submitAuthForm;
window.toggleAuthMode = toggleAuthMode;
window.deleteSavedFlight = deleteSavedFlight;
window.openAuthModal = () => document.getElementById("authModal").style.display = "flex";
window.closeAuthModal = () => document.getElementById("authModal").style.display = "none";

// Shared state
export let currentFlights = [];
export const setCurrentFlights = (val) => { currentFlights = val; };

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize core UI
    updateNavUI();
    loadChatHistory();

    // 2. Chat listeners
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
    if (userInput) userInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleSend();
    });

    // 3. Auth Form
    const authForm = document.getElementById("authForm");
    if (authForm) authForm.addEventListener("submit", submitAuthForm);

    // const toggleAuthBtn = document.getElementById("toggleAuthModeBtn");
    // if (toggleAuthBtn) toggleAuthBtn.addEventListener("click", toggleAuthMode);

    // 4. Save Flight Button Listener (Event Delegation)
    document.addEventListener("click", async (event) => {
        const button = event.target.closest(".save-flight-btn");
        if (!button) return;

        const index = Number(button.dataset.index);
        const flight = currentFlights[index];

        const saved = await saveFlight(flight);
        if (saved) {
            button.innerHTML = '<i class="fa-solid fa-heart text-red-500"></i>';
            button.disabled = true;
        }
    });
});