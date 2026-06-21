// ==========================================
// 1. GLOBAL STATE & MOCK DATA
// ==========================================
let isLoginMode = true;
let flightContext = ""; // Global variable to store origin/dest when date is missing

// Silent Fallback Data
const backupDatabase = [
    { origin: "CPH", destination: "BCN", price: 1200, airline: "MockAir", departure_time: "2026-07-15T08:00:00Z" },
    { origin: "LHR", destination: "JFK", price: 4500, airline: "TestFlights Inc", departure_time: "2026-07-15T14:30:00Z" },
    { origin: "HND", destination: "CDG", price: 8200, airline: "Global Mock", departure_time: "2026-08-01T09:15:00Z" }
];

// ==========================================
// 2. MODALS, DRAWERS & AUTHENTICATION
// ==========================================
function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.toggle('hidden');
}

function toggleDrawer() {
    const drawer = document.getElementById('savedFlightsDrawer');
    if (drawer) drawer.classList.toggle('translate-x-full');
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('modalTitle').innerText = isLoginMode ? 'Login to TripWeave' : 'Create Your Account';
    document.getElementById('authSwitchText').innerText = isLoginMode ? "Don't have an account?" : "Already have an account?";
    document.getElementById('authSwitchBtn').innerText = isLoginMode ? "Sign Up" : "Login";
    const submitBtn = document.querySelector('#loginModal .space-y-4 button');
    if (submitBtn) submitBtn.innerText = isLoginMode ? 'Submit' : 'Sign Up';
}

async function submitAuthForm() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    if (!email || !password) return alert("Please fill out all fields.");
    
    localStorage.setItem('userToken', 'fake_demo_token_123');
    alert(`${isLoginMode ? 'Login' : 'Registration'} successful!`);
    toggleModal('loginModal');
    
    const signInBtn = document.querySelector('button[onclick="toggleModal(\'loginModal\')"]');
    if (signInBtn) {
        signInBtn.innerText = "Log Out";
        signInBtn.onclick = () => {
            localStorage.removeItem('userToken');
            location.reload();
        };
    }
}

// ==========================================
// 3. FRONTEND BRIDGE (GROQ -> DUFFEL)
// ==========================================
async function testLiveFlightSearch(userPrompt) {
    if (!navigator.onLine) {
        alert("⚠️ You are currently offline! Showing saved backup flights.");
        renderFlightsToScreen(backupDatabase);
        return;
    }

    const container = document.getElementById('flightsContainer');
    if (container) {
        container.innerHTML = '<div class="text-center text-gray-500 py-16"><p class="text-lg font-medium animate-pulse">Searching global flights...</p></div>';
    }

    // 1. Prepare the prompt intelligently
    // Capitalize words to trigger Named Entity Recognition (NER) for countries
    const formattedUserPrompt = userPrompt.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    let promptToSend = formattedUserPrompt;
    const lowerPrompt = formattedUserPrompt.toLowerCase();
    
    // Improved check: Does the user look like they are typing a brand new route?
    const isNewSearch = lowerPrompt.includes("from") || lowerPrompt.includes("to") || lowerPrompt.includes("flight") || lowerPrompt.includes("-");

    if (flightContext && !isNewSearch) {
        // Clearer prompt to help the AI parse merged context properly!
        promptToSend = `The user previously asked for: "${flightContext}". They are now replying with: "${formattedUserPrompt}". If this reply contains a date, extract the origin_airport, destination_airport, and departure_date into the required JSON format. Assume the year is 2026 if not specified.`;
    } else if (!flightContext || isNewSearch) {
        // BOOST the prompt for brand new searches to help it find countries
        promptToSend = `Extract a flight search query (origin, destination, date) from this text: "${formattedUserPrompt}". Convert any cities or countries into 3-letter IATA airport codes.`;
    }

    try {
        console.log("1. Sending prompt to Groq API...", promptToSend);
        const groqResponse = await fetch('http://localhost:5050/api/groq/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptToSend })
        });
        
        const groqData = await groqResponse.json();

        // 2. Handle missing date scenario
        // ONLY ask for a date if the AI successfully found the origin and destination first!
        if (!groqData.success && groqData.errors?.includes("missing_departure_date") && !groqData.errors?.includes("missing_origin_airport") && !groqData.errors?.includes("missing_destination_airport")) {
            
            // Check if this is the FIRST time we are missing a date, or if they are typing a brand new search
            if (!flightContext || isNewSearch) {
                flightContext = userPrompt; // Save the good search intent
                appendChatMessage("I'd love to find that flight for you! When would you like to travel?", 'ai');
            } else {
                // We already asked for a date, but they replied with something like "I like pizza"
                appendChatMessage("I'm just a travel assistant, so I didn't quite catch a date in that! Could you please provide a travel date (like 'July 15th') so I can find your flights?", 'ai');
            }
            
            if (container) container.innerHTML = '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
            return;
        }

        // Handle Complete Gibberish on a brand new search
        if (!groqData.success && (!flightContext || isNewSearch) && groqData.errors?.includes("missing_origin_airport") && groqData.errors?.includes("missing_destination_airport")) {
            appendChatMessage("I'm just a travel assistant! I can only help you find flights. Try asking me something like 'Find a flight from London to Paris'.", 'ai');
            if (container) container.innerHTML = ''; 
            flightContext = ""; // Reset
            return;
        }

        // Check if the backend rejected the request for other reasons
        if (!groqData.success) {
            throw new Error(`AI failed to extract flight details. Errors: ${groqData.errors?.join(', ')}`);
        }
        
        // 3. If successful, clear context and proceed to search
        flightContext = ""; 
        const extracted = groqData.data;
        console.log("2. Extracted parameters:", extracted);

        // Prepare Payload
        const duffelPayload = {
            slices: [
                {
                    origin: extracted.origin_airport, 
                    destination: extracted.destination_airport,
                    departure_date: extracted.departure_date
                }
            ],
            passengers: [{ type: "adult" }],
            cabin_class: "economy"
        };

        console.log("3. Fetching live flights from Duffel...");
        const flightResponse = await fetch('http://localhost:5050/api/flights/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(duffelPayload)
        });
        
        const flightData = await flightResponse.json();

        if (flightData.data && flightData.data.data && flightData.data.data.offers.length > 0) {
            console.log("🎉 Live Test Flights Found!");
            renderFlightsToScreen(flightData.data.data.offers); 
        } else {
            appendChatMessage("I couldn't find any flights for those dates. Try another date?", 'ai');
            renderFlightsToScreen(backupDatabase);
        }

    } catch (error) {
        console.error("🚨 Search Error:", error);
        // Clear context on error so the next search is fresh
        flightContext = "";
        renderFlightsToScreen(backupDatabase);
    }
}

// ==========================================
// 4. UI RENDERING
// ==========================================
function appendChatMessage(text, role) {
    const chatHistory = document.querySelector('.chat-history');
    if (!chatHistory) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = role === 'user' ? "message user-message bg-blue-600 text-white max-w-[80%] p-3 rounded-2xl rounded-tr-none text-sm shadow-sm ml-auto" : "message ai-message bg-blue-50 text-blue-900 max-w-[80%] p-3 rounded-2xl rounded-tl-none text-sm shadow-sm";
    msgDiv.innerText = text;
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function renderFlightsToScreen(flightsArray) {
    const container = document.getElementById('flightsContainer');
    if (!container) return;
    container.innerHTML = ''; 
    flightsArray.forEach((flight) => {
        const origin = flight?.slices?.[0]?.origin?.iata_code || "LHR";
        const destination = flight?.slices?.[0]?.destination?.iata_code || "JFK";
        const price = flight.total_amount || flight.price || "0.00";
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center hover:shadow-md transition";
        card.innerHTML = `<div><h3 class="font-bold text-gray-800 text-lg">${origin} ✈️ ${destination}</h3></div><div class="text-right"><p class="font-bold text-xl text-blue-600 mb-2">${price}</p></div>`;
        container.appendChild(card);
    });
}

// ==========================================
// 5. EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('sendBtn');
    const userInput = document.getElementById('userInput');
    function handleSend() {
        const prompt = userInput.value;
        if (prompt.trim() !== "") {
            appendChatMessage(prompt, 'user');
            userInput.value = '';
            testLiveFlightSearch(prompt);
        }
    }
    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (userInput) userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
});