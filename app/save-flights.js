const SAVED_FLIGHTS_API = "http://localhost:5050/api/saved-flights";
async function saveFlight(flight) {
  const token = localStorage.getItem("userToken");

  if (!token) {
    openAuthModal();
    return false;
  }

  try {
    console.log("===== SAVE FLIGHT DEBUG =====");
    console.log("Raw flight object:", JSON.stringify(flight, null, 2));

    // Transform flight object to match backend schema
    // Price might be formatted like "1200 USD", extract just the number
    let price = flight.price;
    if (typeof price === "string") {
      const match = price.match(/[\d.]+/);
      price = match ? parseFloat(match[0]) : 0;
    }

    console.log("Parsed price:", price, typeof price);

    // Ensure departure_time is ISO format with timezone
    let departureTime = flight.departureTime;
    if (!departureTime) {
      throw new Error("Departure time is missing");
    }

    // Force conversion to Date, then to ISO string with Z
    let dateObj;
    if (departureTime instanceof Date) {
      dateObj = departureTime;
    } else if (typeof departureTime === "string") {
      dateObj = new Date(departureTime);
    } else {
      throw new Error(`Invalid departure_time type: ${typeof departureTime}`);
    }

    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid departure_time value: ${departureTime}`);
    }

    // Always convert to ISO string with Z timezone
    departureTime = dateObj.toISOString();

    // Ensure it ends with Z (safety check)
    if (!departureTime.endsWith("Z")) {
      departureTime = departureTime + "Z";
    }

    console.log("Parsed departureTime:", departureTime);

    const origin = String(flight.origin || "").toUpperCase();
    const destination = String(flight.destination || "").toUpperCase();
    const flightNumber = String(
      flight.airlineIata || flight.airline || "UNKNOWN",
    );

    const flightData = {
      flight_number: flightNumber,
      origin: origin,
      destination: destination,
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
    console.log("⏰ DEPARTURE TIME FINAL VALUE:", flightData.departure_time);
    console.log("⏰ HAS Z?:", flightData.departure_time.endsWith("Z"));

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
      console.error("❌ Backend returned error:");
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

  const index = Number(button.dataset.index);

  const flight = currentFlights[index];

  const saved = await saveFlight(flight);

  if (saved) {
    button.innerHTML = '<i class="fa-solid fa-heart text-red-500"></i>';

    button.disabled = true;
  }
});
