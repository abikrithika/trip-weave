// ==========================================
// 1. CUSTOM NOTIFICATIONS (TOASTS)
// ==========================================
function showNotification(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");

  const bgColor = type === "success" ? "bg-green-600" : "bg-red-600";
  const icon = type === "success" ? "✅" : "⚠️";

  toast.className = `transform transition-all duration-300 translate-y-[-20px] opacity-0 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 pointer-events-auto ${bgColor}`;
  toast.innerHTML = `
        <span class="text-lg">${icon}</span>
        <span class="font-medium text-sm flex-1">${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-4 font-bold text-white/80 hover:text-white transition">&times;</button>
    `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("translate-y-[-20px]", "opacity-0");
    toast.classList.add("translate-y-0", "opacity-100");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-[-20px]", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================================
// 2. GLOBAL STATE & MOCK DATA
// ==========================================
let isLoginMode = true;
let flightContext = ""; // Global variable to store origin/dest when date is missing
let flightsMap = null;
let airportsByIataPromise = null;
let mapRouteRequestId = 0;

// Silent Fallback Data (For when offline or errors occur)
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
// 3. MODALS, DRAWERS & AUTHENTICATION
// ==========================================
function openAuthModal() {
  document.getElementById("authModal").style.display = "block";
}

function closeAuthModal() {
  document.getElementById("authModal").style.display = "none";
  document.getElementById("authForm").reset();
}

function toggleDrawer() {
  const drawer = document.getElementById("savedFlightsDrawer");
  if (drawer) drawer.classList.toggle("translate-x-full");
}

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  const title = document.getElementById("authTitle");
  const submitBtn = document.getElementById("authSubmitBtn");
  const toggleBtn = document.getElementById("toggleAuthModeBtn");
  const nameGroup = document.getElementById("nameInputGroup");
  const nameInput = document.getElementById("nameInput");

  if (isLoginMode) {
    title.innerText = "Sign In";
    submitBtn.innerText = "Sign In";
    toggleBtn.innerText = "Need an account? Sign Up";
    nameGroup.style.display = "none";
    nameInput.removeAttribute("required");
  } else {
    title.innerText = "Sign Up";
    submitBtn.innerText = "Create Account";
    toggleBtn.innerText = "Already have an account? Sign In";
    nameGroup.style.display = "block";
    nameInput.setAttribute("required", "true");
  }
}

async function submitAuthForm(e) {
  e.preventDefault();

  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const name = document.getElementById("nameInput")
    ? document.getElementById("nameInput").value.trim()
    : "";

  if (!isLoginMode) {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      showNotification(
        "Password must be at least 8 characters long, contain at least one letter and one number.",
        "error",
      );
      return;
    }
  }

  const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/signup";
  const payload = { email, password };
  if (!isLoginMode) payload.name = name;

  try {
    const response = await fetch(`http://localhost:5050${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : { message: await response.text() };

    if (!response.ok) throw new Error(data.message || "Authentication failed");

    // Success! Save token
    localStorage.setItem("userToken", data.token);

    // TASK 3: Save the currency
    if (data.user && data.user.currency) {
      localStorage.setItem("userCurrency", data.user.currency.code);
    } else {
      localStorage.setItem("userCurrency", "USD");
    }

    showNotification(
      isLoginMode ? "Login successful!" : "Registration successful!",
      "success",
    );
    closeAuthModal();
    updateNavUI();
  } catch (error) {
    console.error("Auth Error:", error);
    showNotification(error.message, "error");
  }
}

function updateNavUI() {
  const authNavBtn = document.getElementById("authNavBtn");
  const token = localStorage.getItem("userToken");

  if (token) {
    authNavBtn.innerText = "Log Out";
    authNavBtn.onclick = () => {
      localStorage.removeItem("userToken");
      localStorage.removeItem("userCurrency");
      updateNavUI();
      showNotification("You have been logged out.", "success");
    };
  } else {
    authNavBtn.innerText = "Sign In";
    authNavBtn.onclick = openAuthModal;
  }
}
updateNavUI();

// ==========================================
// 4. FRONTEND BRIDGE (GROQ -> DUFFEL)
// ==========================================
async function testLiveFlightSearch(userPrompt) {
  if (!navigator.onLine) {
    showNotification(
      "You are currently offline! Showing saved backup flights.",
      "error",
    );
    renderFlightsToScreen(backupDatabase);
    return;
  }

  const container = document.getElementById("flightsContainer");
  if (container) {
    container.innerHTML =
      '<div class="text-center text-gray-500 py-16"><p class="text-lg font-medium animate-pulse">Searching global flights...</p></div>';
  }
  const mapContainer = document.getElementById("mapContainer");
  if (mapContainer) mapContainer.classList.add("hidden");

  const formattedUserPrompt = userPrompt
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  let promptToSend = formattedUserPrompt;
  const lowerPrompt = formattedUserPrompt.toLowerCase();

  const isNewSearch =
    lowerPrompt.includes("flight") ||
    lowerPrompt.includes("-") ||
    (lowerPrompt.includes(" to ") &&
      !lowerPrompt.includes("like to") &&
      !lowerPrompt.includes("want to") &&
      !lowerPrompt.includes("travel to") &&
      !lowerPrompt.includes("need to"));

  if (flightContext && !isNewSearch) {
    promptToSend = `The user previously asked for: "${flightContext}". They are now replying with: "${formattedUserPrompt}". If this reply contains a date, extract the origin_airport, destination_airport, and departure_date into the required JSON format. Assume the year is 2026 if not specified.`;
  } else if (!flightContext || isNewSearch) {
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

    const errors = groqData.errors || [];

    // SCENARIO 1: Missing Date
    if (
      !groqData.success &&
      errors.includes("missing_departure_date") &&
      !errors.includes("missing_destination_airport")
    ) {
      if (!flightContext || isNewSearch) {
        flightContext = userPrompt;
        appendChatMessage(
          "I'd love to find that flight for you! When would you like to travel?",
          "ai",
        );
      } else {
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

    // SCENARIO 2: Total Gibberish on a new search
    if (
      !groqData.success &&
      (!flightContext || isNewSearch) &&
      errors.includes("missing_origin_airport") &&
      errors.includes("missing_destination_airport")
    ) {
      appendChatMessage(
        "I'm just a travel assistant! I can only help you find flights. Try asking me something like 'Find a flight from London to Paris'.",
        "ai",
      );
      if (container) container.innerHTML = "";
      flightContext = "";
      return;
    }

    const canUseOriginFallback =
      !groqData.success &&
      errors.includes("missing_origin_airport") &&
      !errors.includes("missing_destination_airport") &&
      !errors.includes("missing_departure_date") &&
      groqData.data?.destination_airport &&
      groqData.data?.departure_date;

    // SCENARIO 3: DATE TYPO (e.g. "o n 14th")
    if (!groqData.success && flightContext && !canUseOriginFallback) {
      appendChatMessage(
        "I couldn't quite catch that date format. Could you try typing it clearly, like 'July 14th 2026'?",
        "ai",
      );
      if (container)
        container.innerHTML =
          '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
      return;
    }

    if (!groqData.success) {
      if (!canUseOriginFallback) {
        throw new Error(
          `AI failed to extract flight details. Errors: ${errors.join(", ")}`,
        );
      }
    }

    console.log("3. Fetching live flights through AI flight search...");
    const flightResponse = await fetch(
      "http://localhost:5050/api/flights/ai-search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptToSend }),
      },
    );

    const flightData = await flightResponse.json();

    // SCENARIO 4: Safely Handle Past Dates and API Errors right here
    if (
      !flightResponse.ok ||
      flightData.success === false ||
      flightData.error ||
      flightData.errors ||
      !flightData.data
    ) {
      appendChatMessage(
        "Oops! The flight system rejected that request. If you entered a date in the past, please try a future date instead!",
        "ai",
      );
      if (container)
        container.innerHTML =
          '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
      return; // We stop here and KEEP memory alive!
    }

    // SCENARIO 5: Success!
    if (
      flightData.data.data &&
      flightData.data.data.offers &&
      flightData.data.data.offers.length > 0
    ) {
      console.log("🎉 Live Flights Found!");

      flightContext = ""; // ONLY wipe memory on absolute success

      renderFlightsToScreen(flightData.data.data.offers);
    } else {
      appendChatMessage(
        "I couldn't find any flights for those dates. Try another date?",
        "ai",
      );
      if (container)
        container.innerHTML =
          '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
    }
  } catch (error) {
    console.error("🚨 Search Error:", error);
    appendChatMessage(
      "I couldn't quite process that. Let's try again! (Make sure your request is formatted clearly).",
      "ai",
    );
    if (container)
      container.innerHTML =
        '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
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
      ? "message user-message bg-blue-600 text-white max-w-[80%] p-3 rounded-2xl rounded-tr-none text-sm shadow-sm ml-auto mb-4"
      : "message ai-message bg-blue-50 text-blue-900 max-w-[80%] p-3 rounded-2xl rounded-tl-none text-sm shadow-sm mb-4";
  msgDiv.innerText = text;
  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function getIataCode(value) {
  if (!value) return "";
  if (typeof value === "string") return value.toUpperCase();
  return (
    value.iata_code ||
    value.iata ||
    value.code ||
    value.airport_code ||
    ""
  ).toUpperCase();
}

function getFirstSegment(slice) {
  return slice?.segments?.[0] || null;
}

function getLastSegment(slice) {
  const segments = slice?.segments || [];
  return segments[segments.length - 1] || getFirstSegment(slice);
}

function formatTime(value) {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDuration(value, departureTime, arrivalTime) {
  if (value) {
    const isoMatch = String(value).match(/P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/);
    if (isoMatch) {
      const hours = Number(isoMatch[1] || 0);
      const minutes = Number(isoMatch[2] || 0);
      return [hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""]
        .filter(Boolean)
        .join(" ");
    }
  }

  if (departureTime && arrivalTime) {
    const departure = new Date(departureTime);
    const arrival = new Date(arrivalTime);
    const diffMinutes = Math.round((arrival - departure) / 60000);
    if (diffMinutes > 0) {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return [hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""]
        .filter(Boolean)
        .join(" ");
    }
  }

  return "TBD";
}

function getAirlineIata(flight, segment) {
  return (
    flight?.owner?.iata_code ||
    flight?.owner?.iata ||
    flight?.owner_iata_code ||
    flight?.airline_iata ||
    segment?.marketing_carrier?.iata_code ||
    segment?.marketing_carrier?.iata ||
    segment?.operating_carrier?.iata_code ||
    segment?.operating_carrier?.iata ||
    ""
  ).toUpperCase();
}

function getAirlineName(flight, segment) {
  return (
    flight?.owner?.name ||
    flight?.owner_name ||
    flight?.airline ||
    segment?.marketing_carrier?.name ||
    segment?.operating_carrier?.name ||
    "Airline"
  );
}

function getBaggageSummary(flight, segment) {
  const baggageSources = [
    segment?.passengers?.[0]?.baggages,
    flight?.passengers?.[0]?.baggages,
    flight?.included_baggage,
    flight?.baggage,
  ].filter(Boolean);

  const baggageText = JSON.stringify(baggageSources).toLowerCase();

  if (baggageText.includes("checked")) return "checked bag included";
  if (baggageText.includes("cabin") || baggageText.includes("carry"))
    return "cabin bag included";
  if (baggageSources.length) return "baggage included";

  return "cabin bag included";
}

function formatPrice(flight, fallbackCurrency) {
  const amount =
    typeof flight?.total_amount === "string" ||
    typeof flight?.total_amount === "number"
      ? flight.total_amount
      : flight?.total_amount?.amount || flight?.price || "0.00";
  const currency =
    flight?.total_currency || flight?.currency || fallbackCurrency || "USD";
  return `${amount} ${currency}`;
}

function getFlightDisplayData(flight, fallbackCurrency) {
  const slices = flight?.slices || [];
  const outbound = slices[0] || {};
  const inbound = slices[1] || null;
  const firstSegment = getFirstSegment(outbound);
  const lastSegment = getLastSegment(outbound);
  const segmentCount = outbound?.segments?.length || 1;

  const origin =
    getIataCode(firstSegment?.origin) ||
    getIataCode(outbound?.origin) ||
    getIataCode(flight?.origin) ||
    "LHR";
  const destination =
    getIataCode(lastSegment?.destination) ||
    getIataCode(outbound?.destination) ||
    getIataCode(flight?.destination) ||
    "JFK";
  const departureTime =
    firstSegment?.departing_at ||
    firstSegment?.departure_time ||
    outbound?.departing_at ||
    outbound?.departure_time ||
    flight?.departure_time ||
    "";
  const arrivalTime =
    lastSegment?.arriving_at ||
    lastSegment?.arrival_time ||
    outbound?.arriving_at ||
    outbound?.arrival_time ||
    "";
  const airlineIata = getAirlineIata(flight, firstSegment);

  return {
    origin,
    destination,
    departureTime,
    arrivalTime,
    departureLabel: formatTime(departureTime),
    arrivalLabel: formatTime(arrivalTime),
    duration: formatDuration(outbound?.duration, departureTime, arrivalTime),
    stops: segmentCount <= 1 ? "Direct" : `${segmentCount - 1} stop${segmentCount > 2 ? "s" : ""}`,
    baggage: getBaggageSummary(flight, firstSegment),
    airline: getAirlineName(flight, firstSegment),
    airlineIata,
    logoUrl: airlineIata
      ? `https://www.gstatic.com/flights/airline_logos/70px/${airlineIata}.png`
      : "",
    price: formatPrice(flight, fallbackCurrency),
    tripType: inbound ? "Round-trip" : "One-way",
    returnInfo: inbound
      ? inbound.departure_date ||
        inbound?.segments?.[0]?.departing_at ||
        inbound?.segments?.[0]?.departure_time ||
        ""
      : "",
  };
}

function renderFlightsToScreen(flightsArray) {
  const container = document.getElementById("flightsContainer");
  if (!container) return;
  container.innerHTML = "";

  // Fetch dynamic currency from LocalStorage
  const userCurrency = localStorage.getItem("userCurrency") || "USD";

  if (!Array.isArray(flightsArray) || flightsArray.length === 0) {
    container.innerHTML =
      '<div class="text-center text-gray-500 py-8">No flight offers found.</div>';
    return;
  }

  const displayFlights = flightsArray.map((flight) =>
    getFlightDisplayData(flight, userCurrency),
  );

  updateMap(displayFlights[0].origin, displayFlights[0].destination);

  displayFlights.forEach((flight) => {
    const logo = flight.logoUrl
      ? `<img src="${flight.logoUrl}" alt="${flight.airline} logo" class="h-12 w-12 rounded-lg object-contain bg-gray-50 border border-gray-100" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="h-12 w-12 rounded-lg bg-blue-50 text-blue-700 font-bold items-center justify-center border border-blue-100" style="display:none;">${flight.airlineIata || flight.airline.slice(0, 2).toUpperCase()}</div>`
      : `<div class="h-12 w-12 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center border border-blue-100">${flight.airline.slice(0, 2).toUpperCase()}</div>`;

    const card = document.createElement("div");
    card.className =
      "bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition mb-3";

    card.innerHTML = `
            <div class="flex items-start gap-4">
                ${logo}
                <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <h3 class="font-bold text-gray-900 text-lg leading-tight">${flight.origin} ${flight.departureLabel} &rarr; ${flight.destination} ${flight.arrivalLabel}</h3>
                        <span class="inline-block bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded">${flight.tripType}</span>
                    </div>
                    <p class="text-sm text-gray-600 mt-1">${flight.airline}</p>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 text-sm text-gray-700">
                        <p><span class="font-semibold text-gray-900">Duration:</span> ${flight.duration}</p>
                        <p><span class="font-semibold text-gray-900">Stops:</span> ${flight.stops}</p>
                        <p><span class="font-semibold text-gray-900">Baggage:</span> ${flight.baggage}</p>
                    </div>
                    ${
                      flight.returnInfo
                        ? `<p class="text-sm text-gray-700 mt-2"><span class="font-semibold text-gray-900">Return:</span> ${formatTime(flight.returnInfo)}</p>`
                        : ""
                    }
                </div>
                <div class="text-right shrink-0">
                    <p class="font-bold text-xl text-blue-600 mb-2">${flight.price}</p>
                    <button class="mt-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition">Save Offer</button>
                </div>
            </div>
        `;

    container.appendChild(card);
  });
}

// ==========================================
// 6. EVENT LISTENERS
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
});

// ==========================================
// 7. DYNAMIC MAP RENDERING
// ==========================================
async function loadAirportsByIata() {
  if (!airportsByIataPromise) {
    airportsByIataPromise = fetch("/airports-by-iata.json").then((response) => {
      if (!response.ok) {
        throw new Error("Could not load airport coordinates.");
      }
      return response.json();
    });
  }

  return airportsByIataPromise;
}

function hideMap() {
  const mapContainer = document.getElementById("mapContainer");
  if (!mapContainer) return;

  if (flightsMap) {
    flightsMap.remove();
    flightsMap = null;
  }

  mapContainer.classList.add("hidden");
}

async function updateMap(originCode, destinationCode) {
  const mapContainer = document.getElementById("mapContainer");
  if (!mapContainer) return;

  const requestId = ++mapRouteRequestId;
  const normalizedOriginCode = getIataCode(originCode);
  const normalizedDestinationCode = getIataCode(destinationCode);

  if (
    !normalizedOriginCode ||
    !normalizedDestinationCode ||
    typeof L === "undefined"
  ) {
    hideMap();
    return;
  }

  let airportsByIata;
  try {
    airportsByIata = await loadAirportsByIata();
  } catch (error) {
    console.error("Airport lookup error:", error);
    hideMap();
    return;
  }

  if (requestId !== mapRouteRequestId) return;

  const origin = airportsByIata[normalizedOriginCode];
  const destination = airportsByIata[normalizedDestinationCode];

  if (!origin || !destination) {
    hideMap();
    return;
  }

  mapContainer.classList.remove("hidden");

  if (flightsMap) {
    flightsMap.remove();
    flightsMap = null;
  }

  flightsMap = L.map(mapContainer, {
    zoomControl: false,
    attributionControl: false,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(flightsMap);

  const route = [
    [origin.lat, origin.lng],
    [destination.lat, destination.lng],
  ];

  L.polyline(route, { color: "#2563eb", weight: 4, opacity: 0.8 }).addTo(
    flightsMap,
  );
  L.marker(route[0])
    .addTo(flightsMap)
    .bindPopup(`${normalizedOriginCode} - ${origin.name}`);
  L.marker(route[1])
    .addTo(flightsMap)
    .bindPopup(`${normalizedDestinationCode} - ${destination.name}`);
  flightsMap.fitBounds(route, { padding: [34, 34] });
}
