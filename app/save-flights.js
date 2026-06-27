import { getCurrentFlights } from './js/flights.js';
import { openAuthModal, showNotification } from './js/ui.js';
const SAVED_FLIGHTS_API = "http://localhost:5050/api/saved-flights";

export async function saveFlight(flight) {
  const token = localStorage.getItem("userToken");
  if (!token) { openAuthModal(); return false; }

  try {
    const flightData = {
      flight_number: flight.owner?.iata_code || "UNKNOWN",
      origin: flight.origin,
      destination: flight.destination,
      price: parseFloat(flight.price) || 0,
      departure_time: new Date().toISOString(),
      currency_id: null
    };

    const response = await fetch(`${SAVED_FLIGHTS_API}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(flightData),
    });
    
    if (!response.ok) throw new Error("Failed to save");
    showNotification("Flight saved!", "success");
    return true;
  } catch (error) {
    showNotification(error.message, "error");
    return false;
  }
}
export async function loadSavedFlights() {
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
export async function deleteSavedFlight(id) {
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

  const index = Number(button.dataset.index);
  
  // FIX: Access the data via the imported getter function
  const flights = getCurrentFlights(); 
  const flight = flights[index];

  const saved = await saveFlight(flight);

  if (saved) {
    button.innerHTML = '<i class="fa-solid fa-heart text-red-500"></i>';
    button.disabled = true;
  }
});
