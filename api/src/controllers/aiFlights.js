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
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit) || 7, 1);
  console.log("--- DEBUG: RECEIVED PAYLOAD ---");
  console.log(JSON.stringify(req.body, null, 2));
  if (req.body.slices) {
    try {
      if (!req.body.slices[0].origin) {
        req.body.slices[0].origin = await detectFallbackOrigin(req);
      }
      // const flights = await searchFlights(req.body);
      // console.log(JSON.stringify(flights, null, 2));
      // const offers = flights.data?.offers || [];
      // //console.log("offers", offers.length);
      // const start = (page - 1) * limit;
      // const end = start + limit;

      // const paginatedOffers = offers.slice(start, end);
      // return res.status(200).json({
      //   success: true,
      //   query: extracted.parsed,
      //   duffelPayload,

      //   pagination: {
      //     page,
      //     limit,
      //     totalOffers: offers.length,
      //     totalPages: Math.ceil(offers.length / limit),
      //     hasNextPage: end < offers.length,
      //     hasPreviousPage: page > 1,
      //   },

      //   data: {
      //     ...flights.data,
      //     offers: paginatedOffers,
      //   },
      // });
      const flights = await searchFlights(req.body);

      const offers = flights.data?.data?.offers || flights.data?.offers || [];

      const start = (page - 1) * limit;
      const end = start + limit;

      const paginatedOffers = offers.slice(start, end);
      const totalPages = Math.ceil(offers.length / limit);
      return res.status(200).json({
        success: true,

        pagination: {
          page,
          limit,
          totalOffers: offers.length,
          totalPages,
          hasNextPage: end < offers.length,
          hasPreviousPage: page > 1,
        },

        data: {
          offers: paginatedOffers,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  const userText = req.body?.prompt ?? req.body?.text ?? req.body?.userText;

  if (typeof userText !== "string" || userText.trim() === "") {
    return res
      .status(400)
      .json({ success: false, message: "Missing request data." });
  }

  try {
    const extracted = await extractTripQuery(userText.trim());
    console.log("AI extraction result:", {
      ok: extracted.ok,
      errors: extracted.errors,
      parsed: extracted.parsed,
    });

    if (!extracted.ok) {
      const errs = extracted.errors || [];
      // If origin is missing but destination/date was extracted, apply fallback and continue.
      if (
        extracted.parsed &&
        !extracted.parsed.origin_airport &&
        extracted.parsed.destination_airport
      ) {
        const fallback = await detectFallbackOrigin(req);
        extracted.parsed.origin_airport = fallback;
        console.log(
          "Applied fallback origin (heuristic) and continuing:",
          fallback,
          "errors:",
          errs,
        );
      } else {
        return res.status(422).json({
          success: false,
          message: "Could not extract a complete flight search query.",
          query: extracted.parsed,
          errors: extracted.errors,
        });
      }
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
