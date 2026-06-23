// ==========================================
// 1. CUSTOM NOTIFICATIONS (TOASTS)
// ==========================================
function showNotification(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    const icon = type === 'success' ? '✅' : '⚠️';

    toast.className = `transform transition-all duration-300 translate-y-[-20px] opacity-0 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 pointer-events-auto ${bgColor}`;
    toast.innerHTML = `
        <span class="text-lg">${icon}</span>
        <span class="font-medium text-sm flex-1">${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-4 font-bold text-white/80 hover:text-white transition">&times;</button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-[-20px]', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// 2. GLOBAL STATE & MOCK DATA
// ==========================================
let isLoginMode = true;
let flightContext = ""; // Global variable to store origin/dest when date is missing

// Silent Fallback Data (For when offline or errors occur)
const backupDatabase = [
    { origin: "CPH", destination: "BCN", price: 1200, airline: "MockAir", departure_time: "2026-07-15T08:00:00Z" },
    { origin: "LHR", destination: "JFK", price: 4500, airline: "TestFlights Inc", departure_time: "2026-07-15T14:30:00Z" },
    { origin: "HND", destination: "CDG", price: 8200, airline: "Global Mock", departure_time: "2026-08-01T09:15:00Z" }
];

// ==========================================
// 3. MODALS, DRAWERS & AUTHENTICATION
// ==========================================
function openAuthModal() {
    document.getElementById('authModal').style.display = 'block';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('authForm').reset();
}

function toggleDrawer() {
    const drawer = document.getElementById('savedFlightsDrawer');
    if (drawer) drawer.classList.toggle('translate-x-full');
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleBtn = document.getElementById('toggleAuthModeBtn');
    const nameGroup = document.getElementById('nameInputGroup'); 
    const nameInput = document.getElementById('nameInput');

    if (isLoginMode) {
        title.innerText = 'Sign In';
        submitBtn.innerText = 'Sign In';
        toggleBtn.innerText = 'Need an account? Sign Up';
        nameGroup.style.display = 'none';
        nameInput.removeAttribute('required');
    } else {
        title.innerText = 'Sign Up';
        submitBtn.innerText = 'Create Account';
        toggleBtn.innerText = 'Already have an account? Sign In';
        nameGroup.style.display = 'block';
        nameInput.setAttribute('required', 'true');
    }
}

async function submitAuthForm(e) {
    e.preventDefault(); 

    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const name = document.getElementById('nameInput') ? document.getElementById('nameInput').value.trim() : "";

    if (!isLoginMode) {
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            showNotification("Password must be at least 8 characters long, contain at least one letter and one number.", "error");
            return; 
        }
    }

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/signup';
    const payload = { email, password };
    if (!isLoginMode) payload.name = name; 

    try {
        const response = await fetch(`http://localhost:5050${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.message || 'Authentication failed');

        // Success! Save token
        localStorage.setItem('userToken', data.token);
        
        // TASK 3: Save the currency
        if (data.user && data.user.currency) {
            localStorage.setItem('userCurrency', data.user.currency.code);
        } else {
            localStorage.setItem('userCurrency', 'USD');
        }

        showNotification(isLoginMode ? 'Login successful!' : 'Registration successful!', 'success');
        closeAuthModal();
        updateNavUI(); 
    } catch (error) {
        console.error('Auth Error:', error);
        showNotification(error.message, "error");
    }
}

function updateNavUI() {
    const authNavBtn = document.getElementById('authNavBtn');
    const token = localStorage.getItem('userToken');
    
    if (token) {
        authNavBtn.innerText = 'Log Out';
        authNavBtn.onclick = () => {
            localStorage.removeItem('userToken');
            localStorage.removeItem('userCurrency');
            updateNavUI();
            showNotification('You have been logged out.', 'success');
        };
    } else {
        authNavBtn.innerText = 'Sign In';
        authNavBtn.onclick = openAuthModal;
    }
}
updateNavUI();

// ==========================================
// 4. FRONTEND BRIDGE (GROQ -> DUFFEL)
// ==========================================
async function testLiveFlightSearch(userPrompt) {
    if (!navigator.onLine) {
        showNotification("You are currently offline! Showing saved backup flights.", "error");
        renderFlightsToScreen(backupDatabase);
        return;
    }

    const container = document.getElementById('flightsContainer');
    if (container) {
        container.innerHTML = '<div class="text-center text-gray-500 py-16"><p class="text-lg font-medium animate-pulse">Searching global flights...</p></div>';
    }
    const mapContainer = document.getElementById('mapContainer');
    if (mapContainer) mapContainer.classList.add('hidden');

    const formattedUserPrompt = userPrompt.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    let promptToSend = formattedUserPrompt;
    const lowerPrompt = formattedUserPrompt.toLowerCase();
    
    const isNewSearch = lowerPrompt.includes("flight") || 
                    lowerPrompt.includes("-") || 
                    (lowerPrompt.includes(" to ") && !lowerPrompt.includes("like to") && !lowerPrompt.includes("want to") && !lowerPrompt.includes("travel to") && !lowerPrompt.includes("need to"));

    if (flightContext && !isNewSearch) {
        promptToSend = `The user previously asked for: "${flightContext}". They are now replying with: "${formattedUserPrompt}". If this reply contains a date, extract the origin_airport, destination_airport, and departure_date into the required JSON format. Assume the year is 2026 if not specified.`;
    } else if (!flightContext || isNewSearch) {
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

        // SCENARIO 1: Missing Date Only
        if (!groqData.success && groqData.errors?.includes("missing_departure_date") && !groqData.errors?.includes("missing_origin_airport") && !groqData.errors?.includes("missing_destination_airport")) {
            if (!flightContext || isNewSearch) {
                flightContext = userPrompt; 
                appendChatMessage("I'd love to find that flight for you! When would you like to travel?", 'ai');
            } else {
                appendChatMessage("I'm just a travel assistant, so I didn't quite catch a date in that! Could you please provide a travel date (like 'July 15th') so I can find your flights?", 'ai');
            }
            if (container) container.innerHTML = '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
            return;
        }

        // SCENARIO 2: Total Gibberish on a new search
        if (!groqData.success && (!flightContext || isNewSearch) && groqData.errors?.includes("missing_origin_airport") && groqData.errors?.includes("missing_destination_airport")) {
            appendChatMessage("I'm just a travel assistant! I can only help you find flights. Try asking me something like 'Find a flight from London to Paris'.", 'ai');
            if (container) container.innerHTML = ''; 
            flightContext = ""; 
            return;
        }

        // SCENARIO 3: DATE TYPO (e.g. "o n 14th") 
        if (!groqData.success && flightContext) {
            appendChatMessage("I couldn't quite catch that date format. Could you try typing it clearly, like 'July 14th 2026'?", 'ai');
            if (container) container.innerHTML = '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
            return; 
        }

        if (!groqData.success) {
            throw new Error(`AI failed to extract flight details. Errors: ${groqData.errors?.join(', ')}`);
        }
        
        const extracted = groqData.data;

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

        // SCENARIO 4: Safely Handle Past Dates and API Errors right here
        if (!flightResponse.ok || flightData.success === false || flightData.error || flightData.errors || !flightData.data) {
            appendChatMessage("Oops! The flight system rejected that request. If you entered a date in the past, please try a future date instead!", 'ai');
            if (container) container.innerHTML = '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
            return; // We stop here and KEEP memory alive!
        }

        // SCENARIO 5: Success!
        if (flightData.data.data && flightData.data.data.offers && flightData.data.data.offers.length > 0) {
            console.log("🎉 Live Flights Found!");
            
            flightContext = ""; // ONLY wipe memory on absolute success
            
            renderFlightsToScreen(flightData.data.data.offers); 
            const destinationCode = extracted.destination_airport;
            updateMap(`${destinationCode} Airport`);
        } else {
            appendChatMessage("I couldn't find any flights for those dates. Try another date?", 'ai');
            if (container) container.innerHTML = '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
        }

    } catch (error) {
        console.error("🚨 Search Error:", error);
        appendChatMessage("I couldn't quite process that. Let's try again! (Make sure your request is formatted clearly).", 'ai');
        if (container) container.innerHTML = '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
    }
}
// ==========================================
// 5. UI RENDERING
// ==========================================
function appendChatMessage(text, role) {
    const chatHistory = document.querySelector('.chat-history');
    if (!chatHistory) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = role === 'user' 
        ? "message user-message bg-blue-600 text-white max-w-[80%] p-3 rounded-2xl rounded-tr-none text-sm shadow-sm ml-auto mb-4" 
        : "message ai-message bg-blue-50 text-blue-900 max-w-[80%] p-3 rounded-2xl rounded-tl-none text-sm shadow-sm mb-4";
    msgDiv.innerText = text;
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function renderFlightsToScreen(flightsArray) {
    const container = document.getElementById('flightsContainer');
    if (!container) return;
    container.innerHTML = ''; 
    
    // Fetch dynamic currency from LocalStorage
    const userCurrency = localStorage.getItem('userCurrency') || 'USD';

    flightsArray.forEach((flight) => {
        // Extracting data properly from Duffel or Mock database
        const origin = flight?.slices?.[0]?.origin?.iata_code || flight.origin || "LHR";
        const destination = flight?.slices?.[0]?.destination?.iata_code || flight.destination || "JFK";
        const price = flight.total_amount || flight.price || "0.00";
        
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center hover:shadow-md transition mb-3";
        
        // Inject ${userCurrency} directly into the HTML
        card.innerHTML = `
            <div>
                <h3 class="font-bold text-gray-800 text-lg">${origin} ➔ ${destination}</h3>
            </div>
            <div class="text-right">
                <p class="font-bold text-xl text-blue-600 mb-2">${userCurrency} ${price}</p>
                <button class="mt-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition">Save Offer</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// ==========================================
// 6. EVENT LISTENERS
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
    if (userInput) userInput.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') handleSend(); 
    });
});


// ==========================================
// 7. DYNAMIC MAP RENDERING 
// ==========================================
function updateMap(destinationQuery) {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;

    // Remove the 'hidden' class to show the map
    mapContainer.classList.remove('hidden');

    // Inject the standard Google Maps iframe (with the $ properly included!)
    mapContainer.innerHTML = `
        <iframe 
            width="100%" 
            height="250" 
            style="border:0;" 
            loading="lazy" 
            allowfullscreen
            src="https://maps.google.com/maps?q=${encodeURIComponent(destinationQuery)}&t=&z=12&ie=UTF8&iwloc=&output=embed">
        </iframe>
    `;
}