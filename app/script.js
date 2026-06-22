// ==========================================
// 0. STORAGE LAYER (SAFE WRAPPER)
// ==========================================
const Storage = {
  get(key, fallback = []) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      localStorage.removeItem(key);
      return fallback;
    }
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key) {
    localStorage.removeItem(key);
  },
};
// ==========================================
// 1. GLOBAL STATE & MOCK DATA
// ==========================================
const State = {
  isLoginMode: true,
  flightContext: "",
  savedFlights: Storage.get("savedFlights", []),
  flights: [],
};
// Silent Fallback Data
const backupDatabase = [
  {
    origin: "CPH",
    destination: "BCN",
    price: 1200,
    airline: "MockAir",
    departure_time: "2026-07-15T08:00:00Z",
  },
  {
    origin: "LHR",
    destination: "JFK",
    price: 4500,
    airline: "TestFlights Inc",
    departure_time: "2026-07-15T14:30:00Z",
  },
  {
    origin: "HND",
    destination: "CDG",
    price: 8200,
    airline: "Global Mock",
    departure_time: "2026-08-01T09:15:00Z",
  },
];
// ==========================================
// 2. UI HELPERS
// ==========================================
const UI = {
  el(id) {
    return document.getElementById(id);
  },

  qs(selector) {
    return document.querySelector(selector);
  },

  toggleClass(el, className) {
    if (el) el.classList.toggle(className);
  },

  setText(el, text) {
    if (el) el.innerText = text;
  },
};
// ==========================================
// 3. MODALS, DRAWERS & AUTHENTICATION
// ==========================================

function toggleModal(id) {
  UI.toggleClass(UI.el(id), "hidden");
}

function toggleDrawer() {
  UI.toggleClass(UI.el("savedFlightsDrawer"), "translate-x-full");
}

function toggleAuthMode() {
  State.isLoginMode = !State.isLoginMode;

  UI.setText(
    UI.el("modalTitle"),
    State.isLoginMode ? "Login to TripWeave" : "Create Your Account",
  );

  UI.setText(
    UI.el("authSwitchText"),
    State.isLoginMode ? "Don't have an account?" : "Already have an account?",
  );

  UI.setText(UI.el("authSwitchBtn"), State.isLoginMode ? "Sign Up" : "Login");

  const submitBtn = UI.qs("#loginModal .space-y-4 button");
  if (submitBtn) submitBtn.innerText = State.isLoginMode ? "Submit" : "Sign Up";
}

async function submitAuthForm() {
  const email = UI.el("authEmail")?.value;
  const password = UI.el("authPassword")?.value;

  if (!email || !password) return alert("Please fill out all fields.");

  // Determine the correct endpoint based on whether the user is logging in or signing up
  const endpoint = State.isLoginMode ? "/api/auth/login" : "/api/auth/signup";

  try {
    const response = await fetch(`http://localhost:5050${endpoint}`, {
      method: "POST", // Sends the POST request specified in the Canvas
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Authentication failed");
    }
    // Success! Save the real JWT token to localStorage
    localStorage.setItem("userToken", data.token);
    alert(`${State.isLoginMode ? "Login" : "Registration"} successful!`);
    toggleModal("loginModal");

    // Update UI to reflect logged-in state
    const signInBtn = document.querySelector(
      "button[onclick=\"toggleModal('loginModal')\"]",
    );
    if (signInBtn) {
      signInBtn.innerText = "Log Out";
      signInBtn.onclick = () => {
        localStorage.removeItem("userToken");
        location.reload();
      };
    }
  } catch (error) {
    console.error(" Auth Error:", error);
    alert("Failed to connect to the server. Is the backend running?");
  }
}

// ==========================================
// 4. FRONTEND BRIDGE (GROQ -> DUFFEL)
// ==========================================
async function testLiveFlightSearch(userPrompt) {
  if (!navigator.onLine) {
    alert("⚠️ You are currently offline! Showing saved backup flights.");
    renderFlightsToScreen(backupDatabase);
    return;
  }

  const container = UI.el("flightsContainer");
  if (container) {
    container.innerHTML =
      '<div class="text-center text-gray-500 py-16"><p class="text-lg font-medium animate-pulse">Searching global flights...</p></div>';
  }

  // 1. Prepare the prompt intelligently
  // Capitalize words to trigger Named Entity Recognition (NER) for countries
  const formattedUserPrompt = userPrompt
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  let promptToSend = formattedUserPrompt.toLowerCase();

  // Improved check: Does the user look like they are typing a brand new route?
  const isNewSearch =
    promptToSend.includes("from") ||
    promptToSend.includes("to") ||
    promptToSend.includes("flight") ||
    promptToSend.includes("-");

  if (State.flightContext && !isNewSearch) {
    // Clearer prompt to help the AI parse merged context properly!
    promptToSend = `The user previously asked for: "${State.flightContext}". They are now replying with: "${formattedUserPrompt}". If this reply contains a date, extract the origin_airport, destination_airport, and departure_date into the required JSON format. Assume the year is 2026 if not specified.`;
  } else {
    // BOOST the prompt for brand new searches to help it find countries
    promptToSend = `Extract a flight search query (origin, destination, date) from this text: "${formattedUserPrompt}". Convert any cities or countries into 3-letter IATA airport codes.`;
  }

  try {
    console.log("1. Sending prompt to Groq API...", promptToSend);
    const groqResponse = await fetch("http://localhost:5050/api/groq/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptToSend }),
    });

    const groqData = await groqResponse.json();

    // 2. Handle missing date scenario
    // ONLY ask for a date if the AI successfully found the origin and destination first!
    if (!groqData.success) {
      handleGroqErrors(groqData, userPrompt, isNewSearch, container);
      return;
    }
    // If successful, clear context and proceed to search
    State.flightContext = "";
    const extracted = groqData.data;
    console.log("2. Extracted parameters:", extracted);

    // Prepare Payload
    const duffelPayload = {
      slices: [
        {
          origin: extracted.origin_airport,
          destination: extracted.destination_airport,
          departure_date: extracted.departure_date,
        },
      ],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    };

    console.log("3. Fetching live flights from Duffel...");
    const flightResponse = await fetch(
      "http://localhost:5050/api/flights/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(duffelPayload),
      },
    );

    const flightData = await flightResponse.json();
    const offers = flightData?.data?.data?.offers || [];
    if (offers.length) {
      console.log("🎉 Live Test Flights Found!");
      renderFlightsToScreen(offers);
    } else {
      appendChatMessage(
        "I couldn't find any flights for those dates. Try another date?",
        "ai",
      );
      renderFlightsToScreen(backupDatabase);
    }
  } catch (error) {
    console.error("🚨 Search Error:", error);
    // Clear context on error so the next search is fresh
    State.flightContext = "";
    renderFlightsToScreen(backupDatabase);
  }
}
// separated error handler logic here
function handleGroqErrors(groqData, userPrompt, isNewSearch, container) {
  if (groqData.errors?.includes("missing_departure_date")) {
    State.flightContext = userPrompt;
    appendChatMessage("When would you like to travel?", "ai");
    container.innerHTML = "<p>Waiting for date...</p>";
  }

  if (
    groqData.errors?.includes("missing_origin_airport") &&
    groqData.errors?.includes("missing_destination_airport")
  ) {
    appendChatMessage("Try: 'Flights from London to Paris'", "ai");
    State.flightContext = "";
  }
}
// ==========================================
// 5. UI RENDERING
// ==========================================
function appendChatMessage(text, role) {
  const chatHistory = document.querySelector(".chat-history");
  if (!chatHistory) return;
  const msgDiv = document.createElement("div");
  msgDiv.className =
    role === "user"
      ? "message user-message bg-blue-600 text-white max-w-[80%] p-3 rounded-2xl rounded-tr-none text-sm shadow-sm ml-auto"
      : "message ai-message bg-blue-50 text-blue-900 max-w-[80%] p-3 rounded-2xl rounded-tl-none text-sm shadow-sm";
  msgDiv.innerText = text;
  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}
// ==========================================
// 6.RENDER FLIGHTS
// ==========================================
function renderFlightsToScreen(flightsArray) {
  const container = UI.el("flightsContainer");
  if (!container) return;

  container.innerHTML = "";

  flightsArray.forEach((flight) => {
    const origin =
      flight?.slices?.[0]?.origin?.iata_code || flight.origin || "LHR";
    const destination =
      flight?.slices?.[0]?.destination?.iata_code ||
      flight.destination ||
      "JFK";
    const price = flight.total_amount || flight.price || "0.00";

    const isSaved = State.savedFlights.some(
      (f) =>
        f.origin === origin &&
        f.destination === destination &&
        f.price === price,
    );

    const card = document.createElement("div");

    // card.className =
    //   "bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center hover:shadow-md transition";
    card.className =
      "bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center";

    card.innerHTML = `
  <div>
    <h3 class="font-bold text-gray-800 text-lg">
      ${origin} ✈️ ${destination}
    </h3>
  </div>

  <div class="flex items-center gap-4">
   <span class="font-bold text-blue-600">${price}</span>
<button class="favorite-btn text-red-500 text-xl">
  ❤️
</button>
</div>
`;

    const favBtn = card.querySelector(".favorite-btn");
    console.log(favBtn);
    favBtn.innerHTML = isSaved ? "❤️" : "🤍";
    favBtn.addEventListener("click", () => {
      const exists = State.savedFlights.some(
        (f) =>
          f.origin === origin &&
          f.destination === destination &&
          f.price === price,
      );

      if (exists) {
        State.savedFlights = State.savedFlights.filter(
          (f) =>
            !(
              f.origin === origin &&
              f.destination === destination &&
              f.price === price
            ),
        );

        favBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
      } else {
        State.savedFlights.push({ origin, destination, price });

        favBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
      }

      Storage.set("savedFlights", State.savedFlights);
      renderSavedFlights();
    });

    container.appendChild(card);
  });
}

// ==========================================
// 7. EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  renderSavedFlights();

  const sendBtn = UI.el("sendBtn");
  const input = UI.el("userInput");

  function handleSend() {
    const prompt = input.value.trim();

    if (!prompt) return;
    appendChatMessage(prompt, "user");
    input.value = "";
    testLiveFlightSearch(prompt);
  }
  sendBtn?.addEventListener("click", handleSend);
  input?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSend();
  });
});

// ==========================================
// 8. SAVED FLIGHTS
// ==========================================
function renderSavedFlights() {
  const container = UI.el("savedFlightsContainer");
  if (!container) return;

  container.innerHTML = "";

  if (!State.savedFlights.length) {
    container.innerHTML =
      '<p class="text-gray-500 text-center text-sm mt-8">No saved flights yet.</p>';
    return;
  }

  State.savedFlights.forEach((flight) => {
    const card = document.createElement("div");

    card.className = "bg-blue-50 border border-blue-200 p-3 rounded-lg";

    card.innerHTML = `
      <h4 class="font-bold">
        ${flight.origin} ✈️ ${flight.destination}
      </h4>

      <p class="text-blue-600 font-semibold">
        ${flight.price}
      </p>
    `;

    container.appendChild(card);
  });
}
