import { appendChatMessage } from "./chat.js";
import { showNotification } from "./ui.js";
import { getAirlineDisplayData } from "./airline.js";
let conversationState = {
  destination: null
};
// Global cache for toggling hearts
window.savedFlightsCache = [];

const fullSchemaInstruction = `RETURN A VALID JSON OBJECT WITH THESE KEYS: "origin_airport", "destination_airport", "departure_date", "trip_type", "return_date", "max_price_dkk", "vibe_tags", "filters". RULES: 1. Assume the year is 2026. 2. Convert countries/cities to 3-letter IATA codes. 3. STRICTLY format "departure_date" as YYYY-MM-DD. 4. If any field is missing, use NULL.`;

let flightContext = "";

// --- HELPER FUNCTIONS ---
function formatDepartureDate(departingAt) {
  if (!departingAt) return "N/A";
  return new Date(departingAt).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function calculateFlightDuration(segment) {
  if (!segment?.departing_at || !segment?.arriving_at) return "N/A";
  const diff = new Date(segment.arriving_at) - new Date(segment.departing_at);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function getBaggageInfo(flight) {
  const baggages = flight.slices?.[0]?.segments?.[0]?.passengers?.[0]?.baggages ?? flight.baggages ?? flight.baggage;
  if (!Array.isArray(baggages) || baggages.length === 0) return { none: "No baggage included" };
  const carryOn = baggages.find(b => b.type?.toLowerCase().includes("carry") || b.type?.toLowerCase().includes("cabin"));
  const checked = baggages.find(b => b.type?.toLowerCase().includes("checked"));
  return { carryOn: carryOn ? `${carryOn.quantity} carry-on bag` : null, checked: checked ? `${checked.quantity} checked bag` : null, none: !carryOn && !checked ? "No baggage included" : null };
}

function createInfoRow(text, className = "text-xs text-gray-500") {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  return p;
}

// --- RENDER FUNCTION ---
export function renderFlightsToScreen(flightsArray, showAll = false) {
  const container = document.getElementById("flightsContainer");
  if (!container) return;

  container.innerHTML = "";
  const userCurrency = localStorage.getItem("userCurrency") || "USD";

  const limit = 2;
  const displayFlights = showAll ? flightsArray : flightsArray.slice(0, limit);

  displayFlights.forEach((flight) => {
    const airlineData = getAirlineDisplayData(flight);
    const segment = flight.slices?.[0]?.segments?.[0];
    const baggage = getBaggageInfo(flight);
   const isSaved = window.savedFlightsCache?.some(f => 
  String(f.flight_number || f.flightNumber) === String(flight.flight_number)
);

    const card = document.createElement("div");
    card.className = "bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition mb-3";

    const wrapper = document.createElement("div");
    wrapper.className = "flex items-start gap-4";

    if (airlineData.logoUrl) {
      const logo = document.createElement("img");
      logo.src = airlineData.logoUrl;
      logo.className = "h-12 w-12 rounded-lg object-contain bg-gray-50 border border-gray-100";
      logo.onerror = () => (logo.style.display = "none");
      wrapper.appendChild(logo);
    }

    const details = document.createElement("div");
    details.className = "flex-1";
    details.append(
      Object.assign(document.createElement("h3"), { className: "font-bold text-gray-800 text-lg", textContent: `${flight.slices?.[0]?.origin?.iata_code ?? "N/A"} ➔ ${flight.slices?.[0]?.destination?.iata_code ?? "N/A"}` }),
      createInfoRow(airlineData.name, "text-sm text-gray-600"),
      createInfoRow(`Departure: ${formatDepartureDate(segment?.departing_at)}`, "text-sm text-gray-600"),
      createInfoRow(`Duration: ${calculateFlightDuration(segment)}`)
    );

    const baggageRow = document.createElement("div");
    baggageRow.className = "flex items-center gap-6 text-sm text-gray-600 mt-2";
    if (baggage.none) baggageRow.innerHTML = `<span class="flex items-center gap-1 text-red-500"><i class="fa-solid fa-ban"></i> ${baggage.none}</span>`;
    else {
      if (baggage.carryOn) baggageRow.innerHTML += `<span class="flex items-center gap-1"><i class="fa-solid fa-briefcase"></i> ${baggage.carryOn}</span>`;
      if (baggage.checked) baggageRow.innerHTML += `<span class="flex items-center gap-1"><i class="fa-solid fa-suitcase"></i> ${baggage.checked}</span>`;
    }
    details.appendChild(baggageRow);

    const priceColumn = document.createElement("div");
    priceColumn.className = "text-right flex flex-col items-end gap-2";
    const saveButton = document.createElement("button");
    saveButton.className = `save-flight-btn ${isSaved ? 'text-red-500' : 'text-gray-500'}`;
    saveButton.dataset.flight = JSON.stringify(flight);
    saveButton.innerHTML = `<i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>`;
    
    priceColumn.append(
        Object.assign(document.createElement("p"), { className: "font-bold text-xl text-blue-600", textContent: `${userCurrency} ${flight.total_amount ?? "0.00"}` }),
        saveButton
    );

    wrapper.append(details, priceColumn);
    card.appendChild(wrapper);
    container.appendChild(card);
  });

  if (!showAll && flightsArray.length > limit) {
    const btn = document.createElement("button");
    btn.textContent = "View more flights...";
    btn.className = "text-blue-600 text-sm font-semibold w-full py-2 hover:underline mt-2";
    btn.onclick = () => renderFlightsToScreen(flightsArray, true);
    container.appendChild(btn);
  }
}
// --- CORE SEARCH LOGIC ---
export async function testLiveFlightSearch(userPrompt) {
  const container = document.getElementById("flightsContainer");

  // 1. Gibberish check
  const isGibberish = userPrompt.length < 4 || !/[aeiou]/i.test(userPrompt);
  if (isGibberish) {
    appendChatMessage("Im just a travel Assistant Could you tell me where you'd like to fly?", "ai", true);
    return;
  }

  try {
    // 2. Define prompt and fetch BEFORE using it
const promptToSend = `
Extract flight search parameters from: "${userPrompt}". 
- destination_airport: identify and extract the city or country mentioned by the user.
- origin_airport: default to "CPH" if not mentioned.
- departure_date: extract as YYYY-MM-DD, or null if missing.
Return ONLY valid JSON.
`;
    const groqResponse = await fetch("http://localhost:5050/api/groq/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ prompt: promptToSend })
});

if (!groqResponse.ok) {
  let errorData;
 try {
    errorData = await groqResponse.json();
  }catch (e) {
    errorData = { errors: [`Server responded with ${groqResponse.status}`] };
  }
  throw new Error(errorData.errors?.[1] || `Server responded with ${groqResponse.status}`);
}
    const groqData = await groqResponse.json();
   console.log("FULL GROQ RESPONSE:", JSON.stringify(groqData, null, 2));
  const extracted = groqData.parsed || groqData.data || groqData || {};
if (!extracted.destination_airport) {
    const match = userPrompt.match(/to\s+([a-zA-Z\s]+)/i);
    if (match && match[1]) {
        extracted.destination_airport = match[1].trim();
        console.log("Extracted destination from safety net:", extracted.destination_airport);
    }
}
   if (extracted.destination_airport) {
    conversationState.destination = extracted.destination_airport;
}
const finalDestination = conversationState.destination;

if (!finalDestination) {
    appendChatMessage("I'm a travel assistant. Where would you like to fly today?", "ai", true);
    return;
}
    if (!extracted.departure_date) {
      appendChatMessage(`That's great you want to fly to ${conversationState.destination}..could you please provide when would you like to travel`, "ai", true);
      return;
    }

    // 5. Past date check
    const departureDate = new Date(extracted.departure_date);
    if (departureDate < new Date().setHours(0, 0, 0, 0)) {
      appendChatMessage("I cannot search for flights in the past. Please provide a future date.", "ai", true);
      return;
    }

    // 6. Search UI
    if (container) container.innerHTML = '<div class="text-center text-gray-500 py-16"><p class="text-lg font-medium animate-pulse">Searching global flights...</p></div>';

    // 7. Execute search
   const payload = {
      slices: [{
        origin: extracted.origin_airport || "CPH",
        destination: conversationState.destination,
        departure_date: extracted.departure_date
      }],
     passengers: [{ type: "adult" }],
      cabin_class: "economy",
filters: {
          direct_only: extracted.direct_only,
          preferred_airlines: extracted.preferred_airlines,
          baggage_required: extracted.baggage_required,
          departure_time: extracted.departure_time
      }

    };

    const flightResponse = await fetch("http://localhost:5050/api/flights/ai-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const flightData = await flightResponse.json();

    if (flightData.data?.data?.offers) {
      renderFlightsToScreen(flightData.data.data.offers, false);
      updateMap(`${conversationState.destination} Airport`);
      conversationState.destination = null; // Clear memory after success
    } else {
      if (container) container.innerHTML = '<p class="text-center py-8">No flights found.</p>';
    }
  } catch (error) {
    console.error("Search Error:", error);
    if (container) {
      // Check if the error message indicates a rate limit
      if (error.message.includes("Rate limit") || error.message.includes("429")) {
        container.innerHTML = '<p class="text-center py-8 text-yellow-600">Usage limit reached. Please wait a few minutes and try again.</p>';
      } else {
        // Show generic error for other issues
        container.innerHTML = '<p class="text-center py-8 text-red-500">Error searching flights. Please try again.</p>';
      }
    }
  }
  }

export function updateMap(destinationQuery) {
  const mapContainer = document.getElementById("mapContainer");
  if (!mapContainer) return;
  
  mapContainer.classList.remove("hidden");
  
  mapContainer.innerHTML = `
  <div class="w-full my-2">
  <iframe width="100%" height="150" style="border:0; border-radius: 8px;" loading="lazy" allowfullscreen
  src="https://www.google.com/maps?q=${encodeURIComponent(destinationQuery)}&t=&z=12&ie=UTF8&iwloc=&output=embed"
            
        </iframe>
        </div>`;
}
//End of file