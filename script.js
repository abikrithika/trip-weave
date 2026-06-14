const chatHistory = document.getElementById("chatHistory");
const offersContainer = document.getElementById("offersContainer");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const micBtn = document.getElementById("micBtn");
const speakBtn = document.getElementById("speakBtn");
const autoSpeakToggle = document.getElementById("autoSpeakToggle");
const voiceStatus = document.getElementById("voiceStatus");

let lastAssistantReply = "";
let isListening = false;

function appendMessage(text, role) {
    const message = document.createElement("div");
    message.className = `message ${role}`;
    message.textContent = text;
    chatHistory.appendChild(message);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function renderOffers(offers = []) {
    offersContainer.innerHTML = "";

    if (!offers.length) {
        const placeholder = document.createElement("article");
        placeholder.className = "flight-card placeholder-card";
        placeholder.innerHTML = "<h3>No offers yet</h3><p>Ask for a route and travel month to generate suggestions.</p>";
        offersContainer.appendChild(placeholder);
        return;
    }

    offers.forEach((offer) => {
        const card = document.createElement("article");
        card.className = "flight-card";
        card.innerHTML = `
            <h3>${offer.route}</h3>
            <p><strong>Airline:</strong> ${offer.airline}</p>
            <p><strong>Estimated Price:</strong> ${offer.price}</p>
            <p><strong>Duration:</strong> ${offer.duration}</p>
            <div class="tag-row">
                <span class="tag">${offer.stops}</span>
                <span class="tag">${offer.cabin}</span>
            </div>
        `;
        offersContainer.appendChild(card);
    });
}

function speakText(text) {
    if (!window.speechSynthesis) {
        voiceStatus.textContent = "Text-to-speech is not supported in this browser.";
        return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
}

async function sendMessage(message) {
    appendMessage(message, "user");

    try {
        const response = await fetch("/api/assistant", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error("Assistant request failed");
        }

        const data = await response.json();
        const reply = data.reply || "I could not generate a reply right now.";

        lastAssistantReply = reply;
        appendMessage(reply, "assistant");
        renderOffers(data.offers || []);

        if (autoSpeakToggle.checked) {
            speakText(reply);
        }
    } catch (error) {
        appendMessage("I hit an error while contacting the assistant. Please try again.", "assistant");
    }
}

chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = userInput.value.trim();
    if (!message) {
        return;
    }

    userInput.value = "";
    await sendMessage(message);
});

speakBtn.addEventListener("click", () => {
    if (!lastAssistantReply) {
        voiceStatus.textContent = "No assistant reply yet. Ask a question first.";
        return;
    }

    speakText(lastAssistantReply);
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
        isListening = true;
        micBtn.textContent = "Stop Voice Input";
        micBtn.classList.add("recording");
        voiceStatus.textContent = "Listening... speak now.";
    };

    recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
            transcript += event.results[i][0].transcript;
        }
        userInput.value = transcript.trim();
        voiceStatus.textContent = "Voice captured. Edit if needed, then send.";
    };

    recognition.onerror = (event) => {
        voiceStatus.textContent = `Voice input error: ${event.error}`;
    };

    recognition.onend = () => {
        isListening = false;
        micBtn.textContent = "Start Voice Input";
        micBtn.classList.remove("recording");
    };

    micBtn.addEventListener("click", () => {
        if (isListening) {
            recognition.stop();
            return;
        }

        recognition.start();
    });
} else {
    micBtn.disabled = true;
    voiceStatus.textContent = "Speech recognition is not supported in this browser.";
}

appendMessage("Hello! I can help you explore flights. You can type or use voice input.", "assistant");
