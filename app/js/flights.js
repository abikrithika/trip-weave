import { appendChatMessage, createStreamingAssistantMessage } from "./chat.js";
import { showNotification } from "./ui.js";
import { getAirlineDisplayData } from "./airline.js";
import { renderPagination, setPaginationPrompt } from "./pagination.js";
import { API_BASE, consumeSseStream } from "./sse.js";

let conversationState = {
  destination: null,
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
export function renderFlightsToScreen(flightsArray) {
  const container = document.getElementById("flightsContainer");
  if (!container) return;
  container.innerHTML = "";
  const userCurrency = localStorage.getItem("userCurrency") || "USD";
  flightsArray.forEach((flight) => {
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
}

// --- CORE SEARCH LOGIC ---
export async function testLiveFlightSearch(userPrompt, page = 1, silent = false) {
  const container = document.getElementById("flightsContainer");
  setPaginationPrompt(userPrompt);

  if (!navigator.onLine) {
    showNotification("You are currently offline!", "error");
    return;
  }

  const formattedUserPrompt = userPrompt.trim();

  // Only validate and stream for fresh searches, not pagination
  if (!silent) {
    const isGibberish =
      formattedUserPrompt.length < 4 || !/[aeiou]/i.test(formattedUserPrompt);
    if (isGibberish) {
      appendChatMessage(
        "I'm just a travel assistant. Could you tell me where you'd like to fly?",
        "ai",
        true,
      );
      return;
    }
  }

  // For pagination, show a subtle loading state instead of a new chat bubble
  const stream = silent ? null : createStreamingAssistantMessage();
  if (!silent && !stream) return;

  if (silent && container) {
    container.innerHTML = '<p class="text-center py-8 text-gray-400">Loading...</p>';
  }

  try {
    const response = await fetch(`${API_BASE}/api/flights/search-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: formattedUserPrompt,
        page,
        context: conversationState.destination
          ? { destination: conversationState.destination }
          : undefined,
      }),
    });

    let searchStarted = false;
    let finalOffers = null;
    let finalDestination = null;
    let finalPagination = null;

    await consumeSseStream(response, {
      status: ({ text }) => { if (!silent) stream.appendStatus(text); },
      message: ({ text }) => { if (!silent) stream.appendMessage(text); },
      complete: ({ destination, offers, pagination }) => {
        finalDestination = destination;
        finalOffers = offers;
        finalPagination = pagination;
        searchStarted = true;
      },
      error: ({ message }) => {
        if (container) {
          container.innerHTML = `<p class="text-center py-8 text-red-500">${message}</p>`;
        }
      },
      done: ({ needsInput, context }) => {
        if (context?.destination) {
          conversationState.destination = context.destination;
        }
        if (!needsInput) {
          conversationState.destination = null;
        }
      },
    });

    if (!silent) await stream.finish(true);

    if (searchStarted && finalOffers?.length > 0) {
      renderFlightsToScreen(finalOffers);
      if (finalPagination) renderPagination(finalPagination);
      updateMap(`${finalDestination} Airport`);
    } else if (searchStarted) {
      if (container) container.innerHTML = '<p class="text-center py-8">No flights found.</p>';
    }
  } catch (error) {
    console.error("🚨 Search Error:", error);
    if (!silent) {
      await stream.appendMessage("Something went wrong. Please try again.");
      await stream.finish(true);
    }
    if (container) {
      container.innerHTML = '<p class="text-center py-8 text-red-500">Error searching flights. Please try again.</p>';
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
  src="https://www.google.com/maps?q=${encodeURIComponent(destinationQuery)}&t=&z=12&ie=UTF8&iwloc=&output=embed">
        </iframe>
        </div>`;
}
//End of file