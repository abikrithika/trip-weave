import { appendChatMessage } from "./chat.js";
import { showNotification } from "./ui.js";
import { getAirlineDisplayData, getAirlineIata } from "./airline.js";
import { renderPagination, setPaginationPrompt } from "./pagination.js";
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
let searchSession = {
  query: null,
  extracted: null,
};

export async function testLiveFlightSearch(userPrompt, page = 1) {
  setPaginationPrompt(userPrompt);

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
  //new search
  const isNewSearch =
    lowerPrompt.includes("fly to") || lowerPrompt.includes("flight");

  if (isNewSearch) {
    searchSession = { query: null, extracted: null };
  }

  const promptToSend = `
    Current known flight info: ${JSON.stringify(searchSession.extracted || {})}.
    User update: "${formattedUserPrompt}".
    Merge these to extract full flight details.
    ${fullSchemaInstruction.replace(/\n/g, " ")}
  `;

  try {
    if (
      !searchSession.extracted ||
      searchSession.query !== formattedUserPrompt
    ) {
      const groqResponse = await fetch(
        "http://localhost:5050/api/groq/extract",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: promptToSend }),
        },
      );

      if (!groqResponse.ok) throw new Error("422");

      const groqData = await groqResponse.json();

      searchSession = {
        query: formattedUserPrompt,
        extracted: groqData.data || {},
      };
    }

    let extracted = { ...searchSession.extracted };

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
    if (!extracted.destination_airport && !extracted.departure_date) {
      appendChatMessage(
        "I'm not sure where and when you'd like to fly. Could you clarify?",
        "ai",
        true,
      );
      return;
    }

    if (!extracted.destination_airport) {
      appendChatMessage("Which city are you flying to?", "ai", true);
      return;
    }

    if (!extracted.departure_date) {
      appendChatMessage("When are you planning to fly?", "ai", true);
      container.innerHTML =
        '<div class="text-center text-gray-500 py-8">Waiting for travel date...</div>';
      return;
    }

    const today = new Date("2026-06-26");
    const depDate = new Date(extracted.departure_date);

    if (depDate < today) {
      searchSession.extracted.departure_date = null;

      appendChatMessage(
        "That date has already passed. Please choose a future date.",
        "ai",
        true,
      );
      return;
    }

    const payload = {
      slices: [
        {
          origin: extracted.origin_airport || undefined,
          destination: extracted.destination_airport,
          departure_date: extracted.departure_date,
        },
      ],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    };

    const flightResponse = await fetch(
      `http://localhost:5050/api/flights/ai-search?page=${page}&limit=7`,
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

    if (flightData.data.offers.length > 0) {
      renderFlightsToScreen(flightData.data.offers);
      renderPagination(flightData.pagination);

      updateMap(`${extracted.destination_airport} Airport`);
    } else {
      appendChatMessage(
        "No flights found for this date. Try another?",
        "ai",
        true,
      );
      container.innerHTML = "";
    }
  } catch (error) {
    console.error("🚨 Search Error:", error);

    if (container) container.innerHTML = "";

    if (
      error.message.includes("422") ||
      error.message.includes("Flight system error") ||
      error.message.includes("Failed to fetch")
    ) {
      appendChatMessage(
        "Flight service is busy. Please try again shortly.",
        "ai",
        true,
      );
    } else {
      appendChatMessage(
        "I couldn't process that request. Try rephrasing it.",
        "ai",
        true,
      );
    }
  }
}
function formatDepartureDate(departingAt) {
  if (!departingAt) return "N/A";

  return new Date(departingAt).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calculateFlightDuration(segment) {
  if (!segment?.departing_at || !segment?.arriving_at) {
    return "N/A";
  }

  const departure = new Date(segment.departing_at);
  const arrival = new Date(segment.arriving_at);

  const diff = arrival - departure;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

function getBaggageInfo(flight) {
  const baggages =
    flight.slices?.[0]?.segments?.[0]?.passengers?.[0]?.baggages ??
    flight.baggages ??
    flight.baggage;

  // Legacy string support
  if (typeof baggages === "string") {
    return {
      carry_on: null,
      checked: baggages,
    };
  }

  if (!Array.isArray(baggages) || baggages.length === 0) {
    return {
      carry_on: null,
      checked: null,
      none: "No baggage included",
    };
  }

  const carryOn = baggages.find(
    (b) =>
      b.type?.toLowerCase().includes("carry") ||
      b.type?.toLowerCase().includes("cabin"),
  );

  const checked = baggages.find((b) =>
    b.type?.toLowerCase().includes("checked"),
  );

  return {
    carryOn: carryOn
      ? `${carryOn.quantity} carry-on bag${carryOn.quantity > 1 ? "s" : ""}`
      : null,
    checked: checked
      ? `${checked.quantity} checked bag${checked.quantity > 1 ? "s" : ""}`
      : null,
    none: !carryOn && !checked ? "No baggage included" : null,
  };
}
function createInfoRow(text, className = "text-xs text-gray-500") {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  return p;
}
export function renderFlightsToScreen(flightsArray) {
  const container = document.getElementById("flightsContainer");
  if (!container) return;

  container.innerHTML = "";

  const userCurrency = localStorage.getItem("userCurrency") || "USD";

  flightsArray.forEach((flight) => {
    const airlineData = getAirlineDisplayData(flight);
    const segment = flight.slices?.[0]?.segments?.[0];

    const card = document.createElement("div");
    card.className =
      "bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition mb-3";

    const wrapper = document.createElement("div");
    wrapper.className = "flex items-start gap-4";

    if (airlineData.logoUrl) {
      const logo = document.createElement("img");
      logo.src = airlineData.logoUrl;
      logo.className =
        "h-12 w-12 rounded-lg object-contain bg-gray-50 border border-gray-100";
      logo.onerror = () => (logo.style.display = "none");

      wrapper.appendChild(logo);
    }

    const details = document.createElement("div");
    details.className = "flex-1";

    const route = document.createElement("h3");
    route.className = "font-bold text-gray-800 text-lg";
    route.textContent =
      `${flight.slices?.[0]?.origin?.iata_code ?? "N/A"} ➔ ` +
      `${flight.slices?.[0]?.destination?.iata_code ?? "N/A"}`;

    const airline = createInfoRow(airlineData.name, "text-sm text-gray-600");

    const departure = createInfoRow(
      `Departure: ${formatDepartureDate(segment?.departing_at)}`,
      "text-sm text-gray-600",
    );

    const duration = createInfoRow(
      `Duration: ${calculateFlightDuration(segment)}`,
    );
    console.log(flight.slices[0].segments[0].passengers);
    const baggage = getBaggageInfo(flight);

    const baggageRow = document.createElement("div");
    baggageRow.className = "flex items-center gap-6 text-sm text-gray-600 mt-2";

    if (baggage.none) {
      const span = document.createElement("span");
      span.className = "flex items-center gap-1 text-red-500";
      span.innerHTML = `
    <i class="fa-solid fa-ban"></i>
    ${baggage.none}
  `;
      baggageRow.appendChild(span);
    } else {
      if (baggage.carryOn) {
        const span = document.createElement("span");
        span.className = "flex items-center gap-1";
        span.innerHTML = `
      <i class="fa-solid fa-briefcase"></i>
      ${baggage.carryOn}
    `;
        baggageRow.appendChild(span);
      }

      if (baggage.checked) {
        const span = document.createElement("span");
        span.className = "flex items-center gap-1";
        span.innerHTML = `
      <i class="fa-solid fa-suitcase"></i>
      ${baggage.checked}
    `;
        baggageRow.appendChild(span);
      }
    }
    details.append(route, airline, departure, duration, baggageRow);

    const priceColumn = document.createElement("div");
    priceColumn.className = "text-right flex flex-col items-end gap-2";

    const price = document.createElement("p");
    price.className = "font-bold text-xl text-blue-600";
    price.textContent = `${userCurrency} ${flight.total_amount ?? "0.00"}`;

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
