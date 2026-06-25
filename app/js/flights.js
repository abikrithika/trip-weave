import { appendChatMessage } from './chat.js';
import { showNotification } from './ui.js';
let flightContext = "";
export async function testLiveFlightSearch(userPrompt) {
  if (!navigator.onLine) {
    showNotification("You are currently offline! Showing saved backup flights.", "error");
    renderFlightsToScreen(backupDatabase);
    return;
  }

  const container = document.getElementById("flightsContainer");
  if (container) {
    container.innerHTML = '<div class="text-center text-gray-500 py-16"><p class="text-lg font-medium animate-pulse">Searching global flights...</p></div>';
  }
  const mapContainer = document.getElementById("mapContainer");
  if (mapContainer) mapContainer.classList.add("hidden");

  const formattedUserPrompt = userPrompt.trim();
  const lowerPrompt = formattedUserPrompt.toLowerCase();

  // SMARTER MEMORY: Detect if the user is completely changing their mind
  const isNewSearch =
    lowerPrompt.includes("fly to") ||
    lowerPrompt.includes("flight") ||
    (lowerPrompt.includes(" to ") && !lowerPrompt.match(/\d/)); // Matches "to paris" but ignores dates like "10 to 12"

  // If they are starting a brand new search, completely wipe the old memory!
  if (isNewSearch) {
    flightContext = "";
  }

  let promptToSend = "";
  if (flightContext) {
    promptToSend = `The user previously asked for: "${flightContext}". They are now replying with: "${formattedUserPrompt}". Extract the origin_airport, destination_airport, and departure_date. Assume the current year is 2026. If they specify a year (like 2027), strictly use it. STRICT INSTRUCTION: Convert entire countries to 3-letter IATA airport codes (e.g., Italy -> FCO). Do NOT include 'cabin_class', 'currency', or 'passengers' in your JSON.`;
  } else {
    promptToSend = `Extract a flight search query (origin, destination, date) from this text: "${formattedUserPrompt}". Assume the current year is 2026. STRICT INSTRUCTION: Convert entire countries or cities into 3-letter IATA airport codes (e.g., Italy -> FCO). Do NOT include 'cabin_class', 'currency', or 'passengers' in your JSON.`;
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
    const errorString = JSON.stringify(errors);

    // FIX 1: Explicitly catch and report Groq Rate Limits!
    if (errorString.includes("Rate limit")) {
      appendChatMessage("I'm receiving too many requests right now! Please wait about 10 seconds and try sending your message again.", "ai", true);
      if (container) container.innerHTML = '<div class="text-center text-gray-500 py-8">Waiting for rate limit to reset...</div>';
      return;
    }

    // SCENARIO 1: Missing Date
    if (!groqData.success && errors.includes("missing_departure_date") && !errors.includes("missing_destination_airport")) {
      flightContext = formattedUserPrompt; // Save the destination for the next round
      appendChatMessage("I'd love to find that flight for you! When would you like to travel?", "ai", true);
      if (container) container.innerHTML = '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
      return;
    }

    // SCENARIO 2: Total Gibberish
    if (!groqData.success && !flightContext && errors.includes("missing_origin_airport") && errors.includes("missing_destination_airport")) {
      appendChatMessage("I'm just a travel assistant! I can only help you find flights. Try asking me something like 'Find a flight from London to Paris'.", "ai", true);
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
      appendChatMessage("I couldn't quite catch that date format. Could you try typing it clearly, like 'July 14th 2026'?", "ai", true);
      if (container) container.innerHTML = '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
      return;
    }

    if (!groqData.success && !canUseOriginFallback) {
      throw new Error(`AI failed to extract flight details. Errors: ${errors.join(", ")}`);
    }

    const extracted = groqData.data;

    console.log("3. Fetching live flights through AI flight search...");
    const flightResponse = await fetch("http://localhost:5050/api/flights/ai-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptToSend }),
    });

    const flightData = await flightResponse.json();

    // SCENARIO 4: API Error (Past dates, invalid routes)
    if (!flightResponse.ok || flightData.success === false || flightData.error || flightData.errors || !flightData.data) {
      appendChatMessage("Oops! The flight system rejected that request. If you entered a date in the past, please try a future date instead!", "ai", true);
      if (container) container.innerHTML = '<div class="text-center text-gray-500 py-8">Waiting for a new travel date...</div>';
      return; // Keep memory alive so they can just type a new date!
    }

    // SCENARIO 5: Success!
    if (flightData.data.data && flightData.data.data.offers && flightData.data.data.offers.length > 0) {
      console.log("🎉 Live Flights Found!");
      flightContext = ""; // ONLY wipe memory on absolute success
      renderFlightsToScreen(flightData.data.data.offers);
      const destinationCode = flightData.query?.destination_airport || extracted.destination_airport;
      updateMap(`${destinationCode} Airport`);
    } else {
      appendChatMessage("I couldn't find any flights for those dates. Try another date?", "ai", true);
      if (container) container.innerHTML = '<div class="text-center text-gray-500 py-8">Waiting for a new travel date...</div>';
    }
  } catch (error) {
    console.error("🚨 Search Error:", error);
    appendChatMessage("I couldn't quite process that. Let's try again! (Make sure your request is formatted clearly).", "ai", true);
    if (container) container.innerHTML = '<div class="text-center text-gray-500 py-8">Waiting for input...</div>';
  }
}

export function renderFlightsToScreen(flightsArray) {
  const container = document.getElementById("flightsContainer");
  if (!container) return;
  container.innerHTML = "";

  // Fetch dynamic currency from LocalStorage
  const userCurrency = localStorage.getItem("userCurrency") || "USD";

  flightsArray.forEach((flight) => {
    const slices = flight?.slices || [];
    const first = slices[0] || {};
    const second = slices[1] || null;

    const origin = first?.origin?.iata_code || flight.origin || "LHR";
    const destination =
      first?.destination?.iata_code || flight.destination || "JFK";

    // Try to extract readable dates/times from common fields
    const departInfo =
      first.departure_date ||
      first?.segments?.[0]?.departure_time ||
      flight.departure_time ||
      "";
    const returnInfo = second
      ? second.departure_date || second?.segments?.[0]?.departure_time || ""
      : null;

    const airline =
      flight?.owner_name ||
      flight?.airline ||
      flight?.slices?.[0]?.segments?.[0]?.marketing_carrier?.name ||
      "Airline";
    const price =
      flight?.total_amount &&
      (typeof flight.total_amount === "string" ||
        typeof flight.total_amount === "number")
        ? flight.total_amount
        : flight?.total_amount?.amount || flight.price || "0.00";

    const card = document.createElement("div");
    card.className =
      "bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition mb-3";

    card.innerHTML = `
            <div class="flex-1">
                <h3 class="font-bold text-gray-800 text-lg">${origin} ➔ ${destination} ${
                  returnInfo
                    ? '<span class="ml-2 inline-block bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded">Round-trip</span>'
                    : '<span class="ml-2 inline-block bg-gray-100 text-gray-800 text-xs font-semibold px-2 py-0.5 rounded">One-way</span>'
                }</h3>
                <p class="text-sm text-gray-600">${airline}</p>
                <p class="text-sm text-gray-700 mt-2">Depart: ${departInfo || "TBD"}</p>
                ${returnInfo ? `<p class="text-sm text-gray-700">Return: ${returnInfo}</p>` : ""}
            </div>
            <div class="text-right ml-4">
                <p class="font-bold text-xl text-blue-600 mb-2">${userCurrency} ${price}</p>
                <button class="mt-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition">Save Offer</button>
            </div>
        `;

    container.appendChild(card);
  });
}


export function updateMap(destinationQuery) {
  const mapContainer = document.getElementById("mapContainer");
  if (!mapContainer) return;

  // Remove the 'hidden' class to show the map
  mapContainer.classList.remove("hidden");

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