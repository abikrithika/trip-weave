import { createRequire } from "module";
import requestIp from "request-ip";
import geoip from "geoip-lite";

const require = createRequire(import.meta.url);
const { airports } = require("airports-json");

const COUNTRY_TO_IATA = {
  DK: "CPH",
  GB: "LHR",
  UK: "LHR",
  US: "JFK",
  FR: "CDG",
  ES: "MAD",
  DE: "FRA",
  IT: "FCO",
  NL: "AMS",
  SE: "ARN",
  NO: "OSL",
  FI: "HEL",
  BE: "BRU",
  AT: "VIE",
  CH: "ZRH",
  IE: "DUB",
  PT: "LIS",
};

const AIRPORT_TYPE_PRIORITY = {
  large_airport: 0,
  medium_airport: 1,
  small_airport: 2,
};

function normalizeLocationName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseCoordinate(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function distanceKm(aLat, aLon, bLat, bLon) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function pickBestAirport(candidates, latitude, longitude) {
  const ranked = [...candidates].sort((a, b) => {
    const typeDiff =
      (AIRPORT_TYPE_PRIORITY[a.type] ?? 9) -
      (AIRPORT_TYPE_PRIORITY[b.type] ?? 9);
    if (typeDiff !== 0) return typeDiff;

    if (latitude != null && longitude != null) {
      const aLat = parseCoordinate(a.latitude_deg);
      const aLon = parseCoordinate(a.longitude_deg);
      const bLat = parseCoordinate(b.latitude_deg);
      const bLon = parseCoordinate(b.longitude_deg);
      if (aLat != null && aLon != null && bLat != null && bLon != null) {
        return (
          distanceKm(latitude, longitude, aLat, aLon) -
          distanceKm(latitude, longitude, bLat, bLon)
        );
      }
    }

    return 0;
  });

  return ranked[0]?.iata_code?.toUpperCase() || null;
}

function scheduledAirportsInCountry(countryCode) {
  const iso = countryCode?.toUpperCase();
  if (!iso) return [];

  return airports.filter(
    (airport) =>
      airport.iso_country?.toUpperCase() === iso &&
      airport.iata_code &&
      airport.scheduled_service === "yes",
  );
}

function findAirportByCity(city, countryCode, latitude, longitude) {
  const normalizedCity = normalizeLocationName(city);
  if (!normalizedCity) return null;

  const inCountry = scheduledAirportsInCountry(countryCode);
  const cityMatches = inCountry.filter((airport) => {
    const municipality = normalizeLocationName(airport.municipality);
    const name = normalizeLocationName(airport.name);
    return (
      municipality === normalizedCity ||
      municipality.includes(normalizedCity) ||
      normalizedCity.includes(municipality) ||
      name.includes(normalizedCity)
    );
  });

  if (cityMatches.length > 0) {
    return pickBestAirport(cityMatches, latitude, longitude);
  }

  return null;
}

function findAirportByCountry(countryCode, latitude, longitude) {
  const iso = countryCode?.toUpperCase();
  if (!iso) return null;
  if (COUNTRY_TO_IATA[iso]) return COUNTRY_TO_IATA[iso];

  return pickBestAirport(scheduledAirportsInCountry(iso), latitude, longitude);
}

function sanitizeIp(ip) {
  if (!ip) return null;

  let value = String(ip).trim();
  if (value.startsWith("::ffff:")) value = value.slice(7);
  if (value === "::1" || value === "127.0.0.1") return null;

  return value;
}

function detectOriginFromIp(req) {
  try {
    const ip = sanitizeIp(requestIp.getClientIp(req));
    if (!ip) return null;

    const geo = geoip.lookup(ip);
    if (!geo) return null;

    const [latitude, longitude] = geo.ll || [];
    const country = geo.country?.toUpperCase();
    const city = geo.city;

    const fromCity = findAirportByCity(city, country, latitude, longitude);
    if (fromCity) return fromCity;

    const fromCountry = findAirportByCountry(country, latitude, longitude);
    if (fromCountry) return fromCountry;

    return null;
  } catch {
    return null;
  }
}

async function detectFallbackOrigin(req) {
  const fromIp = detectOriginFromIp(req);
  if (fromIp) return fromIp;

  return "CPH";
}

export { detectFallbackOrigin, detectOriginFromIp };
