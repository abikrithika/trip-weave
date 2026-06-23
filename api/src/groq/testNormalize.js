import assert from "node:assert/strict";
import { normalizeTripQuery, verifyTripQuery } from "./extractor.js";

const oneWay = normalizeTripQuery({
  origin_airport: " cph ",
  destination_airport: "lis",
  departure_date: "2026-07-15",
  max_price_dkk: "1,500 DKK",
  vibe_tags: "budget, beach",
});

assert.deepEqual(oneWay, {
  trip_type: "one_way",
  origin_airport: "CPH",
  destination_airport: "LIS",
  departure_date: "2026-07-15",
  return_date: null,
  passengers: 1,
  cabin_class: "economy",
  currency: "DKK",
  max_price_dkk: 1500,
  vibe_tags: ["budget", "beach"],
  filters: {
    direct_only: null,
    preferred_airlines: [],
    baggage_required: null,
    departure_time: null,
  },
});
assert.deepEqual(verifyTripQuery(oneWay), []);

const returnTrip = normalizeTripQuery({
  trip_type: "round trip",
  origin_airport: "CPH",
  destination_airport: "BCN",
  departure_date: "2026-08-01",
  return_date: "2026-08-10",
  passengers: "2 adults",
  cabin_class: "business",
  currency: "eur",
  filters: {
    direct_only: "yes",
    preferred_airlines: "SAS, Lufthansa",
    baggage_required: "true",
    departure_time: "Morning",
  },
});

assert.equal(returnTrip.trip_type, "return");
assert.equal(returnTrip.passengers, 2);
assert.equal(returnTrip.currency, "EUR");
assert.deepEqual(returnTrip.filters, {
  direct_only: true,
  preferred_airlines: ["SAS", "Lufthansa"],
  baggage_required: true,
  departure_time: "morning",
});
assert.deepEqual(verifyTripQuery(returnTrip), []);

const invalidReturnTrip = normalizeTripQuery({
  trip_type: "return",
  origin_airport: "CPH",
  destination_airport: "BCN",
  departure_date: "2026-08-10",
  return_date: "2026-08-01",
});

assert.deepEqual(verifyTripQuery(invalidReturnTrip), [
  "return_date_before_departure_date",
]);

console.log("AI flight JSON normalization tests passed.");
