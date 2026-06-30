import { openAuthModal } from "./js/auth.js";
import { showNotification } from "./js/ui.js";
import { getAirlineDisplayData } from "./js/airline.js";

const SAVED_FLIGHTS_API = "http://localhost:5500/api/saved-flights";

function normalizeDepartureTime(value) {
  if (!value) {
    throw new Error("Departure time is missing");
  }

  const dateObj = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(dateObj.getTime())) {
    throw new Error(`Invalid departure_time value: ${value}`);
  }

  const isoTime = dateObj.toISOString();
  return isoTime.endsWith("Z") ? isoTime : `${isoTime}Z`;
}

function findFirstValue(obj, keys) {
  if (!obj || typeof obj !== "object") return null;

  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const nested = findFirstValue(value, keys);
      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

function normalizeFlightForSave(flight) {
  const firstSlice = flight?.slices?.[0] ?? {};
  const firstSegment = firstSlice?.segments?.[0] ?? {};

  const originAirport =
    flight?.origin || firstSlice?.origin || firstSegment?.origin || null;
  const destinationAirport =
    flight?.destination ||
    firstSlice?.destination ||
    firstSegment?.destination ||
    null;

  const rawPrice = findFirstValue(flight, [
    "price",
    "total_amount",
    "intended_total_amount",
    "base_amount",
    "amount",
    "totalAmount",
    "intendedTotalAmount",
  ]);

  const parsedPrice =
    typeof rawPrice === "string"
      ? Number.parseFloat(rawPrice.match(/[\d.]+/)?.[0] ?? "0")
      : Number(rawPrice ?? 0);

  const origin = String(
    originAirport?.iata_code ||
      originAirport?.iataCode ||
      originAirport?.code ||
      flight?.origin_code ||
      flight?.origin ||
      "",
  )
    .toUpperCase()
    .slice(0, 3);

  const destination = String(
    destinationAirport?.iata_code ||
      destinationAirport?.iataCode ||
      destinationAirport?.code ||
      flight?.destination_code ||
      flight?.destination ||
      "",
  )
    .toUpperCase()
    .slice(0, 3);

  const departureValue = findFirstValue(flight, [
    "departureTime",
    "departure_time",
    "departing_at",
    "departure",
  ]);

  const airlineCode =
    flight?.owner?.iata_code ||
    flight?.airline_iata ||
    flight?.slices?.[0]?.segments?.[0]?.marketing_carrier?.iata_code ||
    (typeof flight?.flightNumber === "string"
      ? flight.flightNumber.match(/^[A-Za-z]{1,3}/)?.[0] || ""
      : "");

  return {
    origin,
    destination,
    departureTime: normalizeDepartureTime(departureValue),
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    flightNumber:
      flight?.flight_number ||
      flight?.flightNumber ||
      firstSegment?.marketing_carrier_flight_number ||
      firstSegment?.operating_carrier_flight_number ||
      flight?.id ||
      "UNKNOWN",
    airline:
      flight?.airline ||
      flight?.airline_name ||
      flight?.owner_name ||
      firstSegment?.marketing_carrier?.name ||
      firstSegment?.operating_carrier?.name ||
      "UNKNOWN",
    airlineCode: String(airlineCode).toUpperCase().slice(0, 3),
  };
}

async function saveFlight(flight) {
  const token = localStorage.getItem("userToken");
  const currencyId = localStorage.getItem("userCurrency") === "DKK" ? 1 : 1;

  if (!token) {
    openAuthModal();
    return false;
  }

  try {
    console.log("===== SAVE FLIGHT DEBUG =====");
    console.log("Raw flight object:", JSON.stringify(flight, null, 2));

    const normalizedFlight = normalizeFlightForSave(flight);
    console.log("Normalized flight payload:", normalizedFlight);

    const {
      origin,
      destination,
      departureTime,
      flightNumber,
      price,
      airline,
      airlineCode,
    } = normalizedFlight;

   const flightData = {
  flight_number: String(flightNumber),
  origin,
  destination,
  price: Math.max(0, price),
  departure_time: departureTime,
  currencyId: parseInt(currencyId), // Change from currency_id to currencyId
  airline_code: airlineCode || null,
  airline_name: airline || null,
};

    // Validate required fields
    if (!origin || origin.length !== 3) {
      throw new Error(
        `Invalid origin: "${origin}" (length: ${origin.length}, expected 3)`,
      );
    }
    if (!destination || destination.length !== 3) {
      throw new Error(
        `Invalid destination: "${destination}" (length: ${destination.length}, expected 3)`,
      );
    }
    if (!flightNumber || flightNumber.length < 1) {
      throw new Error(`Invalid flight_number: "${flightNumber}"`);
    }
    if (flightData.price <= 0) {
      throw new Error(`Invalid price: ${flightData.price}`);
    }

    console.log("Validation passed, sending flight data:", flightData);
    console.log("=============================");
    console.log(" DEPARTURE TIME FINAL VALUE:", flightData.departure_time);
    console.log(" HAS Z?:", flightData.departure_time.endsWith("Z"));

    const response = await fetch(`${SAVED_FLIGHTS_API}/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(flightData),
    });
    const data = await response.json();

    console.log("STATUS:", response.status);
    console.log("DATA:", data);
    console.log("DATA (formatted):", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error(" Backend returned error:");
      console.error("Message:", data.message);
      console.error("Errors object:", data.errors);

      let errorText = data.message || "Failed to save flight";
      if (data.errors && typeof data.errors === "object") {
        // Format field errors nicely
        const fieldErrors = Object.entries(data.errors)
          .map(([field, msgs]) => {
            if (Array.isArray(msgs)) {
              return `${field}: ${msgs.join(", ")}`;
            }
            return `${field}: ${msgs}`;
          })
          .join("; ");
        errorText = fieldErrors || errorText;
        console.error("Formatted errors:", errorText);
      }

      throw new Error(errorText);
    }

    showNotification("Flight saved!", "success");

    return true;
  } catch (error) {
    console.error("SaveFlight error:", error);
    showNotification(error.message, "error");
    return false;
  }
}
function clearSavedFlights() {
  const container = document.getElementById("savedFlightsContainer");

  if (!container) return;

  container.innerHTML = "<p class='text-gray-500'>No saved flights.</p>";
}

async function loadSavedFlights() {
  const token = localStorage.getItem("userToken");

  if (!token) {
    clearSavedFlights();
    return;
  }

  clearSavedFlights();

  try {
    const response = await fetch(`${SAVED_FLIGHTS_API}/saved`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearSavedFlights();
        return;
      }

      throw new Error("Failed to load saved flights");
    }

    const data = await response.json();
    window.savedFlightsCache = data.flights || [];
  renderSavedFlights(window.savedFlightsCache);
  } catch (error) {
    console.error(error);
    clearSavedFlights();
  }
}
async function deleteSavedFlight(id) {
  const token = localStorage.getItem("userToken");
console.log("Attempting to delete flight with ID:", id);
  try {
    const response = await fetch(`${SAVED_FLIGHTS_API}/save/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to delete flight");
    }

    showNotification("Flight removed", "success");

    loadSavedFlights();
  } catch (error) {
    console.error(error);
    showNotification(error.message, "error");
  }
}
function renderSavedFlights(flights) {
  const container = document.getElementById("savedFlightsContainer");

  if (!container) return;

  if (!flights.length) {
    container.innerHTML = "<p class='text-gray-500'>No saved flights.</p>";
    return;
  }

  container.innerHTML = flights
   
  .map((flight) => {
    const airlineData = getAirlineDisplayData(flight);
    // Use the flight_number from the flight object directly
    const fNum = flight.flight_number || flight.flightNumber || "UNKNOWN";

    return `
      <div class="border-b py-3">
        <div class="flex items-start gap-3">
          ${airlineData.logoUrl ? `<img src="${airlineData.logoUrl}" alt="${airlineData.name}" class="h-10 w-10 rounded-lg object-contain bg-gray-50 border border-gray-100" onerror="this.style.display='none'" />` : '<div class="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-500">AIR</div>'}
          <div class="flex-1">
            <h4 class="font-semibold">${flight.origin} → ${flight.destination}</h4>
            <p class="text-xs text-gray-500">Flight ${fNum}</p>
            <p class="font-bold text-blue-600 mt-1">USD ${flight.price}</p>
            <div>
              <button
                data-id="${flight.id}"
                data-flight-number="${fNum}"
                class="remove-saved-flight text-red-500 text-sm mt-2"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  })
  .join("");
}

document.addEventListener("click", async (event) => {
  // 1. Handle the Heart Button (Save/Unsave)
  const saveBtn = event.target.closest(".save-flight-btn");
  if (saveBtn) {
    const flight = JSON.parse(saveBtn.dataset.flight || "{}");
    if (!flight || Object.keys(flight).length === 0) return;

    const isCurrentlySaved = saveBtn.classList.contains("text-red-500");

    if (isCurrentlySaved) {
      // Logic for Unsaving
      const savedFlight = window.savedFlightsCache.find(f => String(f.flight_number) === String(flight.flight_number));
      if (savedFlight) {
        await deleteSavedFlight(savedFlight.id);
        // Update this button
        saveBtn.classList.remove("text-red-500");
        saveBtn.classList.add("text-gray-500");
        saveBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
        // Sync other buttons
        updateHeartIcon(flight.flight_number, false);
        window.savedFlightsCache = window.savedFlightsCache.filter(f => f.id !== savedFlight.id);
        loadSavedFlights();
      }
    } else {
      // Logic for Saving
      const saved = await saveFlight(flight);
      if (saved) {
        // Update this button
        saveBtn.classList.add("text-red-500");
        saveBtn.classList.remove("text-gray-500");
        saveBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
        // Sync other buttons
        updateHeartIcon(flight.flight_number, true);
        loadSavedFlights();
      }
    }
    return;
  }

  // 2. Handle the Drawer Remove Button
  const removeBtn = event.target.closest(".remove-saved-flight");
  if (removeBtn) {
    const id = removeBtn.dataset.id;
    const flightNumber = removeBtn.dataset.flightNumber;
console.log("Removing flightNumber:", flightNumber);
    await deleteSavedFlight(id);
    // Sync heart icons to grey
    updateHeartIcon(flightNumber, false);
    window.savedFlightsCache = window.savedFlightsCache.filter(f => f.id !== id);
    loadSavedFlights();
  }
});

window.deleteSavedFlight = deleteSavedFlight;
window.loadSavedFlights = loadSavedFlights;
window.clearSavedFlights = clearSavedFlights;

function updateHeartIcon(flightNumber, isSaved) {
  console.log("Searching for heart button with flight number:", flightNumber);
  const buttons = document.querySelectorAll(`.save-flight-btn[data-flight*='"${flightNumber}"']`);
  console.log("Found buttons:", buttons.length);
  buttons.forEach(btn => {
    if (isSaved) {
      btn.classList.add("text-red-500");
      btn.classList.remove("text-gray-500");
      btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
    } else {
      btn.classList.remove("text-red-500");
      btn.classList.add("text-gray-500");
      btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    }
  });
}