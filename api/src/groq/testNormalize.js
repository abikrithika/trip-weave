import assert from "node:assert/strict";
import { normalizeTripQuery, verifyTripQuery } from "./extractor.js";

const oneWay = normalizeTripQuery({
  origin_airport: " cph ",
  destination_airport: "lis",
  departure_date: "2026-07-15",
  max_price_dkk: 1500,
  vibe_tags: ["budget", "beach"],
});

assert.deepEqual(oneWay, {
  trip_type: "one_way",
  origin_airport: "CPH",
  destination_airport: "LIS",
  destination_country: null,
  destination_country_code: null,
  destination_continent_code: null,
  destination_area: null,
  departure_date: "2026-07-15",
  return_date: null,
  max_price_dkk: 1500,
  vibe_tags: ["budget", "beach"],
  direct_only: null,
  preferred_airlines: [],
  baggage_required: null,
  departure_time: null,
});
assert.deepEqual(verifyTripQuery(oneWay), []);

const returnTrip = normalizeTripQuery({
  trip_type: "round trip",
  origin_airport: "CPH",
  destination_airport: "BCN",
  departure_date: "2026-08-01",
  return_date: "2026-08-10",
  max_price_dkk: 2500,
  vibe_tags: ["budget"],
  direct_only: "yes",
  preferred_airlines: "SAS, Lufthansa",
  baggage_required: "true",
  departure_time: "Morning",
});

assert.equal(returnTrip.trip_type, "return");
assert.equal(returnTrip.direct_only, true);
assert.deepEqual(returnTrip.preferred_airlines, ["SAS", "Lufthansa"]);
assert.equal(returnTrip.baggage_required, true);
assert.equal(returnTrip.departure_time, "morning");
assert.deepEqual(verifyTripQuery(returnTrip), []);

const invalidReturnTrip = normalizeTripQuery({
  trip_type: "return",
  origin_airport: "CPH",
  destination_airport: "BCN",
  departure_date: "2026-08-10",
  return_date: "2026-08-01",
});

assert.deepEqual(verifyTripQuery(invalidReturnTrip), []);

console.log("AI flight JSON normalization tests passed.");
