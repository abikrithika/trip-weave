import { extractTripQuery } from "../groq/extractor.js";
import { searchFlights } from "../services/duffel.js";
import { detectFallbackOrigin } from "../utils/originFallback.js";

function buildDuffelSearchPayload(tripQuery) {
  const slices = [
    {
      origin: tripQuery.origin_airport,
      destination: tripQuery.destination_airport,
      departure_date: tripQuery.departure_date,
    },
  ];

  // If a return_date is provided, add a second slice for the return leg
  if (tripQuery.return_date) {
    slices.push({
      origin: tripQuery.destination_airport,
      destination: tripQuery.origin_airport,
      departure_date: tripQuery.return_date,
    });
  }

  return {
    slices,
    passengers: [{ type: "adult" }],
    cabin_class: "economy",
  };
}

export const aiFlightSearchController = async (req, res, next) => {
  console.log("--- DEBUG: RECEIVED PAYLOAD ---");
  console.log(JSON.stringify(req.body, null, 2));
if (req.body.slices) {
    try {
      if (!req.body.slices[0]?.origin) {
        req.body.slices[0].origin = await detectFallbackOrigin(req);
      }
      const resolvedOrigin = req.body.slices[0].origin;
      if (req.body.slices[1] && !req.body.slices[1].destination) {
        req.body.slices[1].destination = resolvedOrigin;
      }
      const flights = await searchFlights(req.body);
      return res.status(200).json({ success: true, data: flights });
    } catch (error) { return next(error); }
  }

const userText = req.body?.prompt ?? req.body?.text ?? req.body?.userText;

 if (typeof userText !== "string" || userText.trim() === "") {
    return res.status(400).json({ success: false, message: "Missing request data." });
  }

  try {
    const extracted = await extractTripQuery(userText.trim());
    console.log("AI extraction result:", {
      ok: extracted.ok,
      errors: extracted.errors,
      parsed: extracted.parsed,
    });

    if (extracted.parsed && !extracted.parsed.origin_airport) {
      const fallback = await detectFallbackOrigin(req);
      extracted.parsed.origin_airport = fallback;
      console.log("Applied fallback origin from IP:", fallback);
    }

    if (!extracted.ok) {
      return res.status(422).json({
        success: false,
        message: "Could not extract a complete flight search query.",
        query: extracted.parsed,
        errors: extracted.errors,
      });
    }

    const duffelPayload = buildDuffelSearchPayload(extracted.parsed);
    console.log("Calling Duffel with payload:", JSON.stringify(duffelPayload));
    const flights = await searchFlights(duffelPayload);
    console.log(
      "Duffel response received: (truncated)",
      typeof flights === "object"
        ? Array.isArray(flights.data?.data?.offers)
          ? `${flights.data.data.offers.length} offers`
          : "object"
        : typeof flights,
    );

    return res.status(200).json({
      success: true,
      query: extracted.parsed,
      duffelPayload,
      data: flights,
    });
  } catch (error) {
    next(error);
  }
};
