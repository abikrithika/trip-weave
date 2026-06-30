import { appendChatMessage } from "./chat.js";
import { showNotification } from "./ui.js";
import { getAirlineDisplayData } from "./airline.js";
let conversationState = {
  destination: null
};
// Global cache for toggling hearts
window.savedFlightsCache = [];

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

function calculateSliceDuration(slice) {
  const segments = slice?.segments ?? [];
  if (segments.length === 0) return "N/A";
  const first = segments[0];
  const last = segments[segments.length - 1];
  return calculateFlightDuration({ departing_at: first?.departing_at, arriving_at: last?.arriving_at });
}

function isReturnTrip(extracted) {
  return extracted.trip_type === "return" || Boolean(extracted.return_date);
}

function buildSearchSlices(extracted, destination) {
  const origin = extracted.origin_airport || "CPH";
  const slices = [{
    origin,
    destination,
    departure_date: extracted.departure_date,
  }];

  if (extracted.return_date) {
    slices.push({
      origin: destination,
      destination: origin,
      departure_date: extracted.return_date,
    });
  }

  return slices;
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
    const outboundSlice = flight.slices?.[0];
    const returnSlice = flight.slices?.[1];
    const outboundSegment = outboundSlice?.segments?.[0];
    const returnSegment = returnSlice?.segments?.[0];
    const baggage = getBaggageInfo(flight);
    const isSaved = window.savedFlightsCache?.some(f =>
      String(f.flight_number || f.flightNumber) === String(flight.flight_number)
    );

    const originCode = outboundSlice?.origin?.iata_code ?? "N/A";
    const destinationCode = outboundSlice?.destination?.iata_code ?? "N/A";
    const routeLabel = returnSlice
      ? `${originCode} ⇄ ${destinationCode}`
      : `${originCode} ➔ ${destinationCode}`;

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
      Object.assign(document.createElement("h3"), { className: "font-bold text-gray-800 text-lg", textContent: routeLabel }),
      createInfoRow(airlineData.name, "text-sm text-gray-600"),
      createInfoRow(
        `Departure: ${formatDepartureDate(outboundSegment?.departing_at)} -- Duration: ${calculateSliceDuration(outboundSlice)}`,
        "text-sm text-gray-600"
      )
    );

    if (returnSlice) {
      details.append(
        createInfoRow(
          `Return: ${formatDepartureDate(returnSegment?.departing_at)} -- Duration: ${calculateSliceDuration(returnSlice)}`,
          "text-sm text-gray-600"
        )
      );
    }

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
    const extractionPrompt = conversationState.destination
      ? `Context: The user previously mentioned wanting to fly to ${conversationState.destination}.\nUser message: ${userPrompt}`
      : userPrompt;

    const groqResponse = await fetch("http://localhost:5500/api/groq/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: extractionPrompt }),
    });

    const groqData = await groqResponse.json();
    console.log("FULL GROQ RESPONSE:", JSON.stringify(groqData, null, 2));

    const extracted = groqData.parsed || groqData.data || {};
    console.log("Extracted parameters:", JSON.stringify(extracted, null, 2));

    if (!groqResponse.ok && !extracted.destination_airport && !extracted.departure_date) {
      throw new Error(groqData.errors?.[0] || `Server responded with ${groqResponse.status}`);
    }

    if (!extracted.destination_airport) {
      const match = userPrompt.match(/to\s+([a-zA-Z\s]+)/i);
      if (match?.[1]) {
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
      appendChatMessage(`That's great you want to fly to ${conversationState.destination}. Could you please tell me when you'd like to travel?`, "ai", true);
      return;
    }

    const returnTrip = isReturnTrip(extracted);

    if (returnTrip && !extracted.return_date) {
      appendChatMessage(`Got it — a return trip to ${conversationState.destination}. When would you like to come back?`, "ai", true);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const departureDate = new Date(extracted.departure_date);
    if (departureDate < today) {
      appendChatMessage("I cannot search for flights in the past. Please provide a future date.", "ai", true);
      return;
    }

    if (extracted.return_date) {
      const returnDate = new Date(extracted.return_date);
      if (returnDate < today) {
        appendChatMessage("The return date cannot be in the past. Please provide a future return date.", "ai", true);
        return;
      }
      if (returnDate < departureDate) {
        appendChatMessage("The return date must be on or after your departure date.", "ai", true);
        return;
      }
    }

    if (container) {
      container.innerHTML = `<div class="text-center text-gray-500 py-16"><p class="text-lg font-medium animate-pulse">Searching ${returnTrip ? "return" : ""} flights...</p></div>`;
    }

    const payload = {
      slices: buildSearchSlices(extracted, finalDestination),
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
      filters: {
        direct_only: extracted.direct_only,
        preferred_airlines: extracted.preferred_airlines,
        baggage_required: extracted.baggage_required,
        departure_time: extracted.departure_time,
      },
    };

    const flightResponse = await fetch("http://localhost:5500/api/flights/ai-search", {
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