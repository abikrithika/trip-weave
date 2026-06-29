const AIRLINE_NAMES = {
  BA: "British Airways",
  AA: "American Airlines",
  AF: "Air France",
  KL: "KLM",
  LH: "Lufthansa",
  EK: "Emirates",
  QR: "Qatar Airways",
  SQ: "Singapore Airlines",
  VS: "Virgin Atlantic",
  TK: "Turkish Airlines",
  UA: "United Airlines",
  DL: "Delta Air Lines",
  B6: "JetBlue",
  AY: "Finnair",
  AZ: "ITA Airways",
  IB: "Iberia",
  EI: "Aer Lingus",
  FR: "Ryanair",
  U2: "easyJet",
  W6: "Wizz Air",
};

export function getAirlineIata(flight) {
  const airlineCode =
    flight?.owner?.iata_code ||
    flight?.owner?.iataCode ||
    flight?.airline_iata ||
    flight?.airlineIata ||
    flight?.slices?.[0]?.segments?.[0]?.marketing_carrier?.iata_code ||
    flight?.slices?.[0]?.segments?.[0]?.marketing_carrier?.iataCode ||
    flight?.carrierCode ||
    flight?.airlineCode ||
    flight?.airline_code ||
    "";

  return String(airlineCode).toUpperCase();
}

export function getAirlineDisplayData(flight) {
  const airlineName =
    flight?.airline ||
    flight?.airlineName ||
    flight?.airline_name ||
    flight?.owner_name ||
    "";

  const airlineCode =
    flight?.airlineCode ||
    flight?.airline_code ||
    flight?.airlineIata ||
    flight?.carrierCode ||
    (typeof flight?.flightNumber === "string"
      ? flight.flightNumber.match(/^[A-Za-z]{1,3}/)?.[0] || ""
      : "") ||
    getAirlineIata(flight);

  const normalizedCode = String(airlineCode || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  const resolvedName =
    airlineName && airlineName !== "UNKNOWN"
      ? airlineName
      : AIRLINE_NAMES[normalizedCode] || "Airline";

  const logoUrl = normalizedCode
    ? `https://www.gstatic.com/flights/airline_logos/70px/${normalizedCode}.png`
    : "";

  return {
    name: resolvedName,
    logoUrl,
    flightNumber:
      flight?.flightNumber || flight?.flight_number || flight?.id || "Unknown",
    airlineCode: normalizedCode,
  };
}
