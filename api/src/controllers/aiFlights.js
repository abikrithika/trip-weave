import { extractTripQuery } from "../groq/extractor.js";
import { searchFlights } from "../services/duffel.js";

function buildDuffelSearchPayload(tripQuery) {
  return {
    slices: [
      {
        origin: tripQuery.origin_airport,
        destination: tripQuery.destination_airport,
        departure_date: tripQuery.departure_date,
      },
    ],
    passengers: [{ type: "adult" }],
    cabin_class: "economy",
  };
}

export const aiFlightSearchController = async (req, res, next) => {
  const userText = req.body?.prompt ?? req.body?.text ?? req.body?.userText;

  if (typeof userText !== "string" || userText.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Request body must include a non-empty prompt string.",
    });
  }

  try {
    const extracted = await extractTripQuery(userText.trim());

    if (!extracted.ok) {
      return res.status(422).json({
        success: false,
        message: "Could not extract a complete flight search query.",
        query: extracted.parsed,
        errors: extracted.errors,
      });
    }

    const duffelPayload = buildDuffelSearchPayload(extracted.parsed);
    const flights = await searchFlights(duffelPayload);

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
