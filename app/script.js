// ==========================================
// 1. GLOBAL STATE & MOCK DATA
// ==========================================
let isLoginMode = true;
let flightContext = ""; // Global variable to store origin/dest when date is missing

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
//  FILTER STATE
// ==========================================
let allFlights = [];
let activeFilters = {
  maxPrice: null,
  directOnly: false,
  airline: "",
  sortBy: "cheapest",
  baggageIncluded: false,
  timeOfDay: "any",
};

// ==========================================
// 2. MODALS, DRAWERS & AUTHENTICATION
// ==========================================
function toggleModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.toggle("hidden");
}

function toggleDrawer() {
  const drawer = document.getElementById("savedFlightsDrawer");
  if (drawer) drawer.classList.toggle("translate-x-full");
}

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  document.getElementById("modalTitle").innerText = isLoginMode
    ? "Login to TripWeave"
    : "Create Your Account";
  document.getElementById("authSwitchText").innerText = isLoginMode
    ? "Don't have an account?"
    : "Already have an account?";
  document.getElementById("authSwitchBtn").innerText = isLoginMode
    ? "Sign Up"
    : "Login";
  const submitBtn = document.querySelector("#loginModal .space-y-4 button");
  if (submitBtn) submitBtn.innerText = isLoginMode ? "Submit" : "Sign Up";
}

async function submitAuthForm() {
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;

  if (!email || !password) return alert("Please fill out all fields.");

  // Determine the correct endpoint based on whether the user is logging in or signing up
  const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/signup";

  try {
    const response = await fetch(`http://localhost:5050${endpoint}`, {
      method: "POST", // Sends the POST request specified in the Canvas
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Success! Save the real JWT token to localStorage
      localStorage.setItem("userToken", data.token);
      alert(`${isLoginMode ? "Login" : "Registration"} successful!`);
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
    } else {
      // The backend rejected the credentials
      alert(`Error: ${data.message || data.error || "Authentication failed."}`);
    }
  } catch (error) {
    console.error(" Auth Error:", error);
    alert("Failed to connect to the server. Is the backend running?");
  }
}

// ==========================================
// 3. FRONTEND BRIDGE (GROQ -> DUFFEL)
// ==========================================
// Lightweight fallback parser: looks for two IATA codes and a YYYY-MM-DD or simple Month Day dates
function parseFallbackFromPrompt(text) {
  if (!text || typeof text !== "string") return null;
  const upper = text.toUpperCase();
  // find standalone 3-letter codes (word boundaries) to avoid matching inside other words
  const codes = upper.match(/\b[A-Z]{3}\b/g) || [];
  // find ISO-like dates (may be multiple)
  const isoDates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  // find simple month/day like July 20 or Jul 20 (may be multiple)
  const monthDays = [
    ...text.matchAll(
      /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}\b/gi,
    ),
  ];

  // Helper to normalize a single monthDay match into YYYY-MM-DD (assume 2026)
  function toIsoFromMonthDay(md) {
    try {
      const parsed = new Date(md + " 2026");
      if (isNaN(parsed)) return null;
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, "0");
      const dd = String(parsed.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      return null;
    }
  }

  let departure = null;
  let ret = null;
  if (isoDates.length > 0) {
    departure = isoDates[0];
    if (isoDates.length > 1) ret = isoDates[1];
  } else if (monthDays.length > 0) {
    departure = toIsoFromMonthDay(monthDays[0][0]);
    if (monthDays.length > 1) ret = toIsoFromMonthDay(monthDays[1][0]);
  }

  if (codes.length >= 2 && departure) {
    return {
      trip_type: ret ? "return" : "one_way",
      origin_airport: codes[0],
      destination_airport: codes[1],
      departure_date: departure,
      return_date: ret || null,
      passengers: 1,
      cabin_class: "economy",
    };
  }

  return null;
}

async function testLiveFlightSearch(userPrompt) {
  if (!navigator.onLine) {
    alert("⚠️ You are currently offline! Showing saved backup flights.");
    renderFlightsToScreen(backupDatabase);
    return;
  }

  const container = document.getElementById("flightsContainer");
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

  let promptToSend = formattedUserPrompt;
  const lowerPrompt = formattedUserPrompt.toLowerCase();

  // Improved check: Does the user look like they are typing a brand new route?
  const isNewSearch =
    lowerPrompt.includes("from") ||
    lowerPrompt.includes("to") ||
    lowerPrompt.includes("flight") ||
    lowerPrompt.includes("-");

  if (flightContext && !isNewSearch) {
    // Clearer prompt to help the AI parse merged context properly!
    promptToSend = `The user previously asked for: "${flightContext}". They are now replying with: "${formattedUserPrompt}". If this reply contains a date, extract the origin_airport, destination_airport, and departure_date into the required JSON format. Assume the year is 2026 if not specified.`;
  } else if (!flightContext || isNewSearch) {
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

    // If Groq failed to produce structured JSON, attempt a lightweight fallback parse
    if (!groqData.success) {
      const fallback = parseFallbackFromPrompt(formattedUserPrompt);
      if (fallback) {
        console.warn("Using fallback parse from user prompt:", fallback);
        // mimic groqData.data shape used below
        groqData.success = true;
        groqData.data = fallback;
        groqData.errors = [];
      }
    }

    // 2. Handle missing date scenario
    // ONLY ask for a date if the AI successfully found the origin and destination first!
    if (
      !groqData.success &&
      groqData.errors?.includes("missing_departure_date") &&
      !groqData.errors?.includes("missing_origin_airport") &&
      !groqData.errors?.includes("missing_destination_airport")
    ) {
      // Check if this is the FIRST time we are missing a date, or if they are typing a brand new search
      if (!flightContext || isNewSearch) {
        flightContext = userPrompt; // Save the good search intent
        appendChatMessage(
          "I'd love to find that flight for you! When would you like to travel?",
          "ai",
        );
      } else {
        // We already asked for a date, but they replied with something like "I like pizza"
        appendChatMessage(
          "I'm just a travel assistant, so I didn't quite catch a date in that! Could you please provide a travel date (like 'July 15th') so I can find your flights?",
          "ai",
        );
      }

      if (container)
        container.innerHTML =
          '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
      return;
    }

    // Handle Complete Gibberish on a brand new search
    if (
      !groqData.success &&
      (!flightContext || isNewSearch) &&
      groqData.errors?.includes("missing_origin_airport") &&
      groqData.errors?.includes("missing_destination_airport")
    ) {
      appendChatMessage(
        "I'm just a travel assistant! I can only help you find flights. Try asking me something like 'Find a flight from London to Paris'.",
        "ai",
      );
      if (container) container.innerHTML = "";
      flightContext = ""; // Reset
      return;
    }

    // Check if the backend rejected the request for other reasons
    if (!groqData.success) {
      throw new Error(
        `AI failed to extract flight details. Errors: ${groqData.errors?.join(", ")}`,
      );
    }

    // 3. If successful, clear context and proceed to search
    flightContext = "";
    const extracted = groqData.data;
    console.log("2. Extracted parameters:", extracted);

    // Prepare Payload (support return trips and passenger count)
    const slices = [
      {
        origin: extracted.origin_airport,
        destination: extracted.destination_airport,
        departure_date: extracted.departure_date,
      },
    ];

    // If the user requested a return trip and we have a return_date, add the return slice
    if (extracted.trip_type === "return" && extracted.return_date) {
      slices.push({
        origin: extracted.destination_airport,
        destination: extracted.origin_airport,
        departure_date: extracted.return_date,
      });
    }

    // Build passengers array (Duffel expects an array of passenger objects)
    const passengerCount =
      Number.isInteger(extracted.passengers) && extracted.passengers > 0
        ? extracted.passengers
        : 1;
    const passengers = Array.from({ length: passengerCount }, () => ({
      type: "adult",
    }));

    const duffelPayload = {
      slices,
      passengers,
      cabin_class: extracted.cabin_class || "economy",
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

    if (
      flightData.data &&
      flightData.data.data &&
      flightData.data.data.offers.length > 0
    ) {
      console.log("🎉 Live Test Flights Found!");
      renderFlightsToScreen(flightData.data.data.offers);
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
    flightContext = "";
    renderFlightsToScreen(backupDatabase);
  }
}

// ==========================================
// 4. UI RENDERING
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

function renderFlightsToScreen(flightsArray) {
  // normalize and keep original list in memory
  allFlights = (flightsArray || []).map((flight) => {
    const priceRaw =
      flight.total_amount || flight.price || flight?.total?.amount || "0";
    const priceNum = Number(String(priceRaw).replace(/[^0-9.-]+/g, "")) || 0;
    const currency = flight.total_currency || flight?.total?.currency || "USD";
    const slices = flight.slices || flight?.data?.slices || [];

    const sliceSummaries = slices.map((s) => {
      const origin =
        s.origin?.iata_code ||
        s.origin ||
        (s.segments && s.segments[0]?.origin?.iata_code) ||
        "--";
      const destination =
        s.destination?.iata_code ||
        s.destination ||
        (s.segments && s.segments[0]?.destination?.iata_code) ||
        "--";
      const dep =
        s.departure_time ||
        (s.segments && s.segments[0]?.departure_time) ||
        null;
      const arr =
        s.arrival_time || (s.segments && s.segments[0]?.arrival_time) || null;
      const stops = s.segments ? Math.max(0, s.segments.length - 1) : 0;
      let durationMin = null;
      if (dep && arr) {
        const d = new Date(arr) - new Date(dep);
        if (!isNaN(d)) durationMin = Math.round(d / 60000);
      }
      return { origin, destination, dep, arr, stops, durationMin };
    });

    const owner =
      flight.owner?.name ||
      (slices[0] &&
        slices[0].segments &&
        (
          slices[0].segments[0]?.marketing_carrier ||
          slices[0].segments[0]?.operating_carrier
        )?.name) ||
      "Unknown Airline";

    const depTime = sliceSummaries[0]?.dep
      ? new Date(sliceSummaries[0].dep)
      : null;
    const totalDuration =
      sliceSummaries.reduce((acc, s) => acc + (s.durationMin || 0), 0) || null;
    const totalStops = sliceSummaries.reduce(
      (acc, s) => acc + (s.stops || 0),
      0,
    );

    const baggageIncluded = Boolean(
      flight.includes?.some?.((inc) =>
        /baggage|bag/i.test(inc.description || inc.type || ""),
      ) ||
      flight.baggage_included ||
      flight.includes_baggage,
    );

    return {
      raw: flight,
      priceNum,
      currency,
      sliceSummaries,
      owner,
      depTime,
      totalDuration,
      totalStops,
      baggageIncluded,
    };
  });

  renderVisibleFlights();
}

function renderVisibleFlights() {
  const container = document.getElementById("flightsContainer");
  if (!container) return;
  container.innerHTML = "";

  const visibleFlights = allFlights
    .filter((f) => {
      if (activeFilters.directOnly && f.totalStops > 0) return false;
      if (activeFilters.maxPrice != null && activeFilters.maxPrice !== "") {
        if (f.priceNum > Number(activeFilters.maxPrice)) return false;
      }
      if (activeFilters.airline && activeFilters.airline.trim() !== "") {
        if (
          !f.owner
            .toLowerCase()
            .includes(activeFilters.airline.trim().toLowerCase())
        )
          return false;
      }
      if (activeFilters.baggageIncluded && !f.baggageIncluded) return false;
      if (activeFilters.timeOfDay === "morning") {
        if (!f.depTime) return false;
        const h = f.depTime.getHours();
        if (h < 5 || h > 11) return false;
      }
      if (activeFilters.timeOfDay === "evening") {
        if (!f.depTime) return false;
        const h = f.depTime.getHours();
        if (h < 17 || h > 22) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (activeFilters.sortBy === "cheapest") return a.priceNum - b.priceNum;
      if (activeFilters.sortBy === "fastest") {
        const da = a.totalDuration || Number.MAX_SAFE_INTEGER;
        const db = b.totalDuration || Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
        return a.totalStops - b.totalStops;
      }
      return 0;
    });

  if (visibleFlights.length === 0) {
    container.innerHTML =
      '<div class="text-center text-gray-500 py-16"><p class="text-lg font-medium">No flights match the active filters.</p></div>';
    return;
  }

  visibleFlights.forEach((f) => {
    const card = document.createElement("div");
    card.className =
      "bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition mb-4";

    let inner = `<div class="flex justify-between items-start">
            <div>
                <h3 class="font-bold text-gray-800 text-lg">${f.sliceSummaries.map((s) => `${s.origin} → ${s.destination}`).join(" | ")}</h3>
                <p class="text-sm text-gray-600 mt-1">${f.owner}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-xl text-blue-600 mb-2">${f.priceNum} ${f.currency}</p>
            </div>
        </div>
        <div class="mt-3 grid grid-cols-1 gap-2">`;

    f.sliceSummaries.forEach((s, idx) => {
      const depText = s.dep ? new Date(s.dep).toLocaleString() : "TBD";
      const arrText = s.arr ? new Date(s.arr).toLocaleString() : "TBD";
      inner += `<div class="text-sm text-gray-700"> <strong>Leg ${idx + 1}:</strong> ${s.origin} → ${s.destination} — ${depText} → ${arrText} <span class="text-gray-500">(${s.stops} stop${s.stops !== 1 ? "s" : ""}${s.durationMin ? ` · ${s.durationMin}m` : ""})</span></div>`;
    });

    inner += `</div>`;
    card.innerHTML = inner;
    container.appendChild(card);
  });
}

// ==========================================
// 5. EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
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
  if (userInput)
    userInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleSend();
    });

  // Filters UI wiring
  const filterSort = document.getElementById("filterSort");
  const filterDirect = document.getElementById("filterDirect");
  const filterMaxPrice = document.getElementById("filterMaxPrice");
  const filterAirline = document.getElementById("filterAirline");
  const filterBaggage = document.getElementById("filterBaggage");
  const filterTime = document.getElementById("filterTime");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");

  if (filterSort) {
    filterSort.value = activeFilters.sortBy;
    filterSort.addEventListener("change", (e) => {
      activeFilters.sortBy = e.target.value;
      renderVisibleFlights();
    });
  }
  if (filterDirect) {
    filterDirect.checked = activeFilters.directOnly;
    filterDirect.addEventListener("change", (e) => {
      activeFilters.directOnly = e.target.checked;
      renderVisibleFlights();
    });
  }
  if (filterMaxPrice) {
    filterMaxPrice.value = activeFilters.maxPrice || "";
    filterMaxPrice.addEventListener("input", (e) => {
      const v = e.target.value;
      activeFilters.maxPrice = v === "" ? null : Number(v);
      renderVisibleFlights();
    });
  }
  if (filterAirline) {
    filterAirline.value = activeFilters.airline || "";
    filterAirline.addEventListener("input", (e) => {
      activeFilters.airline = e.target.value;
      renderVisibleFlights();
    });
  }
  if (filterBaggage) {
    filterBaggage.checked = activeFilters.baggageIncluded;
    filterBaggage.addEventListener("change", (e) => {
      activeFilters.baggageIncluded = e.target.checked;
      renderVisibleFlights();
    });
  }
  if (filterTime) {
    filterTime.value = activeFilters.timeOfDay;
    filterTime.addEventListener("change", (e) => {
      activeFilters.timeOfDay = e.target.value;
      renderVisibleFlights();
    });
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      activeFilters = {
        maxPrice: null,
        directOnly: false,
        airline: "",
        sortBy: "cheapest",
        baggageIncluded: false,
        timeOfDay: "any",
      };
      if (filterSort) filterSort.value = activeFilters.sortBy;
      if (filterDirect) filterDirect.checked = activeFilters.directOnly;
      if (filterMaxPrice) filterMaxPrice.value = "";
      if (filterAirline) filterAirline.value = "";
      if (filterBaggage) filterBaggage.checked = activeFilters.baggageIncluded;
      if (filterTime) filterTime.value = activeFilters.timeOfDay;
      renderVisibleFlights();
    });
  }
});
