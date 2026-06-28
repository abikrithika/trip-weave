import { openAuthModal } from "./js/auth.js";
import { showNotification } from "./js/ui.js";

const SAVED_FLIGHTS_API = "http://localhost:5050/api/saved-flights";

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
  };
}

async function saveFlight(flight) {
  const token = localStorage.getItem("userToken");

  if (!token) {
    openAuthModal();
    return false;
  }

  try {
    console.log("===== SAVE FLIGHT DEBUG =====");
    console.log("Raw flight object:", JSON.stringify(flight, null, 2));

    const normalizedFlight = normalizeFlightForSave(flight);
    console.log("Normalized flight payload:", normalizedFlight);

    const { origin, destination, departureTime, flightNumber, price } =
      normalizedFlight;

    const flightData = {
      flight_number: String(flightNumber),
      origin,
      destination,
      price: Math.max(0, price),
      departure_time: departureTime,
      currency_id: null,
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
async function loadSavedFlights() {
  const token = localStorage.getItem("userToken");

  if (!token) {
    return;
  }

  try {
    const response = await fetch(`${SAVED_FLIGHTS_API}/saved`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    renderSavedFlights(data.flights || []);
  } catch (error) {
    console.error(error);
  }
}
async function deleteSavedFlight(id) {
  const token = localStorage.getItem("userToken");

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
    .map(
      (flight) => `
      <div class="border-b py-3">

        <h4 class="font-semibold">
          ${flight.origin} → ${flight.destination}
        </h4>

        <p class="text-sm text-gray-600">
          ${flight.airline}
        </p>

        <p class="font-bold text-blue-600">
          ${flight.price}
        </p>

        <button
          onclick="deleteSavedFlight('${flight.id}')"
          class="text-red-500 text-sm mt-2"
        >
          Remove
        </button>

      </div>
    `,
    )
    .join("");
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest(".save-flight-btn");

  if (!button) return;

  const flight = JSON.parse(button.dataset.flight || "{}");

  if (!flight || Object.keys(flight).length === 0) {
    showNotification("Unable to save this flight right now.", "error");
    return;
  }

  const saved = await saveFlight(flight);

  if (saved) {
    button.innerHTML = '<i class="fa-solid fa-heart text-red-500"></i>';
    button.disabled = true;
    loadSavedFlights();
  }
});

window.deleteSavedFlight = deleteSavedFlight;
window.loadSavedFlights = loadSavedFlights;
