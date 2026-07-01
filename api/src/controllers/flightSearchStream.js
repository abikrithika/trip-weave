import { extractTripQuery } from "../groq/extractor.js";
import { searchFlights } from "../services/duffel.js";
import { detectFallbackOrigin } from "../utils/originFallback.js";
import { initSse, sendSseEvent, endSse } from "../utils/sse.js";

function isReturnTrip(extracted) {
  return extracted.trip_type === "return" || Boolean(extracted.return_date);
}

function buildSearchSlices(extracted, destination) {
  const origin = extracted.origin_airport || null;
  const outbound = {
    destination,
    departure_date: extracted.departure_date,
  };
  if (origin) outbound.origin = origin;

  const slices = [outbound];

  if (extracted.return_date) {
    const inbound = {
      origin: destination,
      departure_date: extracted.return_date,
    };
    if (origin) inbound.destination = origin;
    slices.push(inbound);
  }

  return slices;
}

function buildSearchStatusMessages(extracted, returnTrip) {
  const origin = extracted.origin_airport || "your location";
  const dest = extracted.destination_airport;
  const messages = [
    `Searching ${returnTrip ? "return " : ""}flights from ${origin} to ${dest}...`,
  ];

  if (extracted.direct_only) {
    messages.push("Checking direct routes...");
  }
  if (extracted.baggage_required) {
    messages.push("Filtering for flights with baggage included...");
  }
  if (extracted.preferred_airlines?.length > 0) {
    messages.push(
      `Looking at ${extracted.preferred_airlines.join(", ")} flights...`,
    );
  }
  if (extracted.departure_time) {
    messages.push(`Narrowing to ${extracted.departure_time} departures...`);
  }

  messages.push("Comparing prices across airlines...");
  return messages;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function emitStatusLines(res, messages, pauseMs = 400) {
  for (const text of messages) {
    sendSseEvent(res, "status", { text });
    await delay(pauseMs);
  }
}

export const flightSearchStreamController = async (req, res) => {
  initSse(res);

  const userPrompt = req.body?.prompt;
  const contextDestination = req.body?.context?.destination ?? null;
  const page = Math.max(parseInt(req.body?.page) || 1, 1);
  const limit = 7;

  if (typeof userPrompt !== "string" || userPrompt.trim() === "") {
    sendSseEvent(res, "error", { message: "Missing prompt." });
    endSse(res);
    return;
  }

  try {
    sendSseEvent(res, "status", { text: "Understanding your request..." });
    await delay(300);

    const extractionPrompt = contextDestination
      ? `Context: The user previously mentioned wanting to fly to ${contextDestination}.\nUser message: ${userPrompt.trim()}`
      : userPrompt.trim();

    const result = await extractTripQuery(extractionPrompt);
    const extracted = { ...(result.parsed || {}) };

    if (!extracted.origin_airport) {
      extracted.origin_airport = await detectFallbackOrigin(req);
    }

    if (!extracted.destination_airport) {
      const match = userPrompt.match(/to\s+([a-zA-Z\s]+)/i);
      if (match?.[1]) {
        extracted.destination_airport = match[1].trim().toUpperCase();
      }
    }

    let destination = extracted.destination_airport || contextDestination;

    if (!destination) {
      sendSseEvent(res, "message", {
        text: "I'm a travel assistant. Where would you like to fly today?",
      });
      sendSseEvent(res, "done", { needsInput: true });
      endSse(res);
      return;
    }

    if (!extracted.departure_date) {
      sendSseEvent(res, "message", {
        text: `That's great — you want to fly to ${destination}. Could you please tell me when you'd like to travel?`,
      });
      sendSseEvent(res, "done", {
        needsInput: true,
        context: { destination },
      });
      endSse(res);
      return;
    }

    const returnTrip = isReturnTrip(extracted);

    if (returnTrip && !extracted.return_date) {
      sendSseEvent(res, "message", {
        text: `Got it — a return trip to ${destination}. When would you like to come back?`,
      });
      sendSseEvent(res, "done", {
        needsInput: true,
        context: { destination },
      });
      endSse(res);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const departureDate = new Date(extracted.departure_date);
    if (departureDate < today) {
      sendSseEvent(res, "message", {
        text: "I cannot search for flights in the past. Please provide a future date.",
      });
      sendSseEvent(res, "done", { needsInput: true });
      endSse(res);
      return;
    }

    if (extracted.return_date) {
      const returnDate = new Date(extracted.return_date);
      if (returnDate < today) {
        sendSseEvent(res, "message", {
          text: "The return date cannot be in the past. Please provide a future return date.",
        });
        sendSseEvent(res, "done", { needsInput: true });
        endSse(res);
        return;
      }
      if (returnDate < departureDate) {
        sendSseEvent(res, "message", {
          text: "The return date must be on or after your departure date.",
        });
        sendSseEvent(res, "done", { needsInput: true });
        endSse(res);
        return;
      }
    }

    extracted.destination_airport = destination;
    await emitStatusLines(res, buildSearchStatusMessages(extracted, returnTrip));

    const payload = {
      slices: buildSearchSlices(extracted, destination),
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
      filters: {
        direct_only: extracted.direct_only,
        preferred_airlines: extracted.preferred_airlines,
        baggage_required: extracted.baggage_required,
        departure_time: extracted.departure_time,
      },
    };

    const flights = await searchFlights(payload);
    const offers = flights?.data?.offers ?? [];
    const count = offers.length;

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedOffers = offers.slice(start, end);
    const totalPages = Math.max(Math.ceil(offers.length / limit), 1);

    if (count > 0) {
      sendSseEvent(res, "status", {
        text: `Found ${count} possible flight${count === 1 ? "" : "s"}.`,
      });
      await delay(300);
    } else {
      sendSseEvent(res, "status", { text: "No flights found for those dates." });
      await delay(200);
    }

    sendSseEvent(res, "complete", {
      destination,
      offers: paginatedOffers,
      extracted,
      pagination: {
        page,
        limit,
        totalOffers: offers.length,
        totalPages,
        hasNextPage: end < offers.length,
        hasPreviousPage: page > 1,
      },
    });
    sendSseEvent(res, "done", { needsInput: false });
    endSse(res);
  } catch (error) {
    console.error("Flight search stream error:", error);
    const isRateLimit =
      error.message?.includes("Rate limit") || error.message?.includes("429");
    sendSseEvent(res, "error", {
      message: isRateLimit
        ? "Usage limit reached. Please wait a few minutes and try again."
        : "Error searching flights. Please try again.",
    });
    sendSseEvent(res, "done", { needsInput: false });
    endSse(res);
  }
};
