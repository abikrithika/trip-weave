import { appendChatMessage } from "./chat.js";
import { showNotification } from "./ui.js";
import { getAirlineDisplayData, getAirlineIata } from "./airline.js";

const fullSchemaInstruction = `
    RETURN A VALID JSON OBJECT WITH THESE KEYS:
    "origin_airport", "destination_airport", "departure_date", "trip_type", "return_date", "max_price_dkk", "vibe_tags", "filters".
    
    RULES:
    1. Assume the year is 2026.
    2. Convert countries/cities to 3-letter IATA codes (e.g., India -> DEL).
    3. STRICTLY format "departure_date" as YYYY-MM-DD (e.g., 2026-12-06). 
    4. If the user input is ambiguous, infer the most logical upcoming date.
    5. If any field is missing, use NULL.
`;

let flightContext = "";

export async function testLiveFlightSearch(userPrompt) {
  if (!navigator.onLine) {
    showNotification("You are currently offline!", "error");
    return;
  }

  const container = document.getElementById("flightsContainer");
  if (container) {
    container.innerHTML =
      '<div class="text-center text-gray-500 py-16"><p class="text-lg font-medium animate-pulse">Searching global flights...</p></div>';
  }

  const formattedUserPrompt = userPrompt.trim();
  const lowerPrompt = formattedUserPrompt.toLowerCase();

  // 1. Preserve state
  let currentSearchData = {};
  try {
    currentSearchData = flightContext ? JSON.parse(flightContext) : {};
  } catch (e) {
    currentSearchData = {};
  }

  // 2. Only wipe if a brand new search intent is detected
  const isNewSearch =
    lowerPrompt.includes("fly to") || lowerPrompt.includes("flight");
  if (isNewSearch) {
    flightContext = "";
    currentSearchData = {};
  }

  // 3. Prompt uses preserved info
  const promptToSend = `Current known flight info: ${JSON.stringify(currentSearchData)}. User update: "${formattedUserPrompt}". Merge these to extract full flight details. ${fullSchemaInstruction.replace(/\n/g, " ")}`;

  try {
    const groqResponse = await fetch("http://localhost:5050/api/groq/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptToSend }),
    });
    if (!groqResponse.ok) {
      // This will now trigger your catch block
      throw new Error("422");
    }
    const groqData = await groqResponse.json();
    const extracted = groqData.data || {};

    // --- NEW: FORCE NULL IF DATE IS NOT EXPLICITLY IN PROMPT ---
    // Check if the user prompt actually contains numbers/date words
    const dateKeywords = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
      "2026",
      "2027",
      "tomorrow",
      "next",
    ];
    const hasDateInPrompt =
      dateKeywords.some((word) => lowerPrompt.includes(word)) ||
      /\d+/.test(formattedUserPrompt);

    if (!hasDateInPrompt) {
      extracted.departure_date = null;
    }

    // Merge new data with old data so we don't lose the destination!
    const mergedData = { ...currentSearchData, ...extracted };
    flightContext = JSON.stringify(mergedData);

    const hasMeaningfulData =
      mergedData.destination_airport || mergedData.departure_date;

    if (!hasMeaningfulData && isNewSearch === false) {
      appendChatMessage(
        "I'm sorry, I didn't quite catch that. Could you tell me where you'd like to fly?",
        "ai",
        true,
      );
      return;
    }

    flightContext = JSON.stringify(mergedData);

    if (
      mergedData.departure_date &&
      !/^\d{4}-\d{2}-\d{2}$/.test(mergedData.departure_date)
    ) {
      appendChatMessage(
        "I understood the date, but it seems to be in an unusual format. Could you try 'YYYY-MM-DD'?",
        "ai",
        true,
      );
      return;
    }

    // --- GUARD CLAUSES ---
    // 1. Check if we have the destination
    if (!mergedData.destination_airport) {
      appendChatMessage(
        "I'm not sure which city you want to visit. Could you be more specific?",
        "ai",
        true,
      );
      return;
    }

    // 2. Check if we have the date
    if (!mergedData.departure_date) {
      appendChatMessage(
        "I've got the destination, but when are you planning to fly?",
        "ai",
        true,
      );
      if (container)
        container.innerHTML =
          '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
      return;
    }

    // 3. Validate the date (Past check)
    const today = new Date("2026-06-26");
    const depDate = new Date(mergedData.departure_date);
    if (depDate < today) {
      mergedData.departure_date = null;
      flightContext = JSON.stringify(mergedData);

      appendChatMessage(
        "That date has already passed. Please provide a future date.",
        "ai",
        true,
      );
      return;
    }

    // 4. If we reach here, we have everything! Now we search.
    console.log("3. Fetching live flights through AI flight search...");
    const payload = {
      slices: [
        {
          origin: mergedData.origin_airport || undefined,
          destination: mergedData.destination_airport,
          departure_date: mergedData.departure_date,
        },
      ],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    };

    const flightResponse = await fetch(
      "http://localhost:5050/api/flights/ai-search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const flightData = await flightResponse.json();

    if (!flightResponse.ok || !flightData.data) {
      throw new Error("Flight system error");
    }

    if (flightData.data.data?.offers?.length > 0) {
      flightContext = ""; // Clear on success
      renderFlightsToScreen(flightData.data.data.offers);
      updateMap(`${mergedData.destination_airport} Airport`);
    } else {
      appendChatMessage(
        "I couldn't find any flights for that date. Try another?",
        "ai",
        true,
      );
      if (container) container.innerHTML = "";
    }
  } catch (error) {
    console.error("🚨 Search Error:", error);

    // 1. Clear the UI completely so no "Waiting" messages persist
    if (container) container.innerHTML = "";

    // 2. Check for Rate Limit or Server connection issues
    if (
      error.message.includes("422") ||
      error.message.includes("Flight system error") ||
      error.message.includes("Failed to fetch")
    ) {
      appendChatMessage(
        "I'm currently experiencing high traffic and cannot connect to my flight database. Please wait a few minutes before trying again.",
        "ai",
        true,
      );
      return; // Stops the function here
    }

    // 3. Otherwise, handle standard processing errors
    else {
      appendChatMessage(
        "I couldn't process that request. Could you try phrasing it differently?",
        "ai",
        true,
      );
      return; // Stops the function here
    }
  }
}
export function renderFlightsToScreen(flightsArray) {
  const container = document.getElementById("flightsContainer");
  if (!container) return;
  container.innerHTML = "";
  const userCurrency = localStorage.getItem("userCurrency") || "USD";

  flightsArray.forEach((flight) => {
    const airlineData = getAirlineDisplayData(flight);
    const logoUrl = airlineData.logoUrl;

    const card = document.createElement("div");
    card.className =
      "bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition mb-3";

    const wrapper = document.createElement("div");
    wrapper.className = "flex items-start gap-4";

    if (logoUrl) {
      const logo = document.createElement("img");
      logo.src = logoUrl;
      logo.className =
        "h-12 w-12 rounded-lg object-contain bg-gray-50 border border-gray-100";
      logo.onerror = () => {
        logo.style.display = "none";
      };
      wrapper.appendChild(logo);
    }

    const details = document.createElement("div");
    details.className = "flex-1";
    const route = document.createElement("h3");
    route.className = "font-bold text-gray-800 text-lg";
    route.textContent = `${flight.slices?.[0]?.origin?.iata_code || "N/A"} ➔ ${flight.slices?.[0]?.destination?.iata_code || "N/A"}`;
    const airline = document.createElement("p");
    airline.className = "text-sm text-gray-600";
    airline.textContent = airlineData.name;
    details.append(route, airline);

    const priceColumn = document.createElement("div");
    priceColumn.className = "text-right flex flex-col items-end gap-2";
    const price = document.createElement("p");
    price.className = "font-bold text-xl text-blue-600";
    price.textContent = `${userCurrency} ${flight.total_amount || "0.00"}`;

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className =
      "save-flight-btn inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50";
    saveButton.dataset.flight = JSON.stringify(flight);
    saveButton.setAttribute("aria-label", "Save flight");
    saveButton.innerHTML = '<i class="fa-regular fa-heart"></i>';

    priceColumn.append(price, saveButton);
    wrapper.append(details, priceColumn);
    card.appendChild(wrapper);
    container.appendChild(card);
  });
}

export function updateMap(destinationQuery) {
  const mapContainer = document.getElementById("mapContainer");
  if (!mapContainer) return;
  mapContainer.classList.remove("hidden");
  mapContainer.innerHTML = `
        <iframe width="100%" height="250" style="border:0;" loading="lazy" allowfullscreen
            src="https://www.google.com/maps?q=${encodeURIComponent(destinationQuery)}&t=&z=12&ie=UTF8&iwloc=&output=embed"
        </iframe>`;
}
