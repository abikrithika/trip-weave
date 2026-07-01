import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { airports } = require("airports-json");

const COUNTRY_NAMES = {
  IN: "India",
  ES: "Spain",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  GB: "the United Kingdom",
  US: "the United States",
  DK: "Denmark",
  NL: "the Netherlands",
  SE: "Sweden",
  NO: "Norway",
  FI: "Finland",
  PT: "Portugal",
  GR: "Greece",
  HR: "Croatia",
  MT: "Malta",
  CY: "Cyprus",
  AT: "Austria",
  CH: "Switzerland",
  BE: "Belgium",
  IE: "Ireland",
  JP: "Japan",
  TH: "Thailand",
  ID: "Indonesia",
  MY: "Malaysia",
  SG: "Singapore",
  VN: "Vietnam",
  PH: "the Philippines",
  NP: "Nepal",
  LK: "Sri Lanka",
  MV: "the Maldives",
  IS: "Iceland",
  CA: "Canada",
  BR: "Brazil",
  MX: "Mexico",
  JM: "Jamaica",
  DO: "the Dominican Republic",
  BS: "the Bahamas",
  NZ: "New Zealand",
  AU: "Australia",
  KH: "Cambodia"
};

const VIBE_AIRPORTS = {
  beaches: ["BCN", "PMI", "IBZ", "AGP", "ALC", "NCE", "SPU", "DBV", "ATH", "FAO", "GOI", "HKT", "DPS", "MLE", "CEB", "DAD", "MIA", "HNL", "CUN", "GIG", "MBJ", "PUJ", "NAS"],
  hills: ["GVA", "ZRH", "MUC", "INN", "SZG", "SOF", "MXP", "TRN", "KTM", "SXR", "PKR", "CNX", "ALA", "DEN", "SLC", "YVR", "YYC", "BRC"],
  cozy: ["KEF", "EDI", "OSL", "BGO", "ARN", "CPH", "SZG", "RVN", "KIX", "CTS", "TPE", "BTV", "PDX", "SEA", "YQB", "ZQN"],
  "summer vibes": ["IBZ", "PMI", "AGP", "ATH", "FCO", "LIS", "BCN", "NCE", "HER", "RHO", "MIA", "LAX", "SAN", "MCO", "HNL", "GIG", "DPS", "HKT", "GOI"]
};

function normalizeVibe(vibe) {
  if (!vibe) return null;
  const v = vibe.toLowerCase().trim();
  if (v.includes("beach")) return "beaches";
  if (v.includes("hill") || v.includes("mountain")) return "hills";
  if (v.includes("cozy")) return "cozy";
  if (v.includes("summer")) return "summer vibes";
  return null;
}

export function resolveDestination(tripQuery) {
  // If destination_airport is already a valid 3-letter IATA code, just return it.
  if (tripQuery.destination_airport && /^[A-Z]{3}$/.test(tripQuery.destination_airport.trim().toUpperCase())) {
    const iata = tripQuery.destination_airport.trim().toUpperCase();
    const exists = airports.some(a => a.iata_code === iata);
    if (exists) {
      return { destination_airport: iata, explanation: null };
    }
  }

  // 1. Filter airports by Country/Continent/Area constraints
  let candidates = airports.filter(a => a.iata_code && a.scheduled_service === "yes");

  const countryCode = tripQuery.destination_country_code?.trim().toUpperCase();
  const continentCode = tripQuery.destination_continent_code?.trim().toUpperCase();
  const area = tripQuery.destination_area?.toLowerCase().trim();

  // If we have nothing to resolve (no country, continent, area, or vibes), return null
  const hasVibes = tripQuery.vibe_tags && tripQuery.vibe_tags.length > 0;
  if (!countryCode && !continentCode && !area && !hasVibes) {
    return { destination_airport: null, explanation: null };
  }

  if (countryCode && countryCode !== "EU") {
    candidates = candidates.filter(a => a.iso_country?.toUpperCase() === countryCode);
  }

  if (continentCode) {
    candidates = candidates.filter(a => a.continent?.toUpperCase() === continentCode);
  } else if (countryCode === "EU") {
    candidates = candidates.filter(a => a.continent?.toUpperCase() === "EU");
  }

  let appliedArea = null;
  if (area) {
    if (area.includes("south")) {
      appliedArea = "south";
      const isContinentSearch = (continentCode === "EU" || countryCode === "EU") && (!countryCode || countryCode === "EU");
      if (isContinentSearch) {
        candidates = candidates.filter(a => parseFloat(a.latitude_deg) < 45);
      } else {
        const lats = candidates.map(a => parseFloat(a.latitude_deg)).filter(Number.isFinite);
        if (lats.length > 0) {
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const midLat = (minLat + maxLat) / 2;
          candidates = candidates.filter(a => parseFloat(a.latitude_deg) <= midLat);
        }
      }
    } else if (area.includes("north")) {
      appliedArea = "north";
      const lats = candidates.map(a => parseFloat(a.latitude_deg)).filter(Number.isFinite);
      if (lats.length > 0) {
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const midLat = (minLat + maxLat) / 2;
        candidates = candidates.filter(a => parseFloat(a.latitude_deg) > midLat);
      }
    } else if (area.includes("east")) {
      appliedArea = "east";
      const lons = candidates.map(a => parseFloat(a.longitude_deg)).filter(Number.isFinite);
      if (lons.length > 0) {
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const midLon = (minLon + maxLon) / 2;
        candidates = candidates.filter(a => parseFloat(a.longitude_deg) > midLon);
      }
    } else if (area.includes("west")) {
      appliedArea = "west";
      const lons = candidates.map(a => parseFloat(a.longitude_deg)).filter(Number.isFinite);
      if (lons.length > 0) {
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const midLon = (minLon + maxLon) / 2;
        candidates = candidates.filter(a => parseFloat(a.longitude_deg) <= midLon);
      }
    }
  }

  // 2. Filter or prioritize by Vibe tags
  let vibeAirports = [];
  let matchedVibeName = null;
  if (hasVibes) {
    for (const tag of tripQuery.vibe_tags) {
      const normalized = normalizeVibe(tag);
      if (normalized && VIBE_AIRPORTS[normalized]) {
        vibeAirports = vibeAirports.concat(VIBE_AIRPORTS[normalized]);
        matchedVibeName = normalized;
      }
    }
  }

  if (vibeAirports.length > 0) {
    const intersected = candidates.filter(a => vibeAirports.includes(a.iata_code));
    if (intersected.length > 0) {
      candidates = intersected;
    }
  }

  // Filter candidates to only large and medium airports to ensure they are viable destinations
  let viableCandidates = candidates.filter(a => a.type === "large_airport");
  if (viableCandidates.length === 0) {
    viableCandidates = candidates.filter(a => a.type === "medium_airport");
  }
  if (viableCandidates.length === 0) {
    viableCandidates = candidates;
  }

  if (viableCandidates.length === 0) {
    return { destination_airport: null, explanation: null };
  }

  // Pick a random airport from the viable candidates
  const randomIndex = Math.floor(Math.random() * viableCandidates.length);
  const selectedAirport = viableCandidates[randomIndex];
  const destIata = selectedAirport.iata_code;
  const cityName = selectedAirport.municipality || selectedAirport.name;
  const destCountryName = COUNTRY_NAMES[selectedAirport.iso_country] || selectedAirport.iso_country;

  // Generate explanation
  let explanation = "";
  if (matchedVibeName) {
    if (countryCode || continentCode || area) {
      explanation = `Since you want a **${matchedVibeName}** vibe, I selected **${cityName} (${destIata})** in ${destCountryName} for you!`;
    } else {
      explanation = `For a **${matchedVibeName}** getaway, I selected **${cityName} (${destIata})** in ${destCountryName}!`;
    }
  } else if (area) {
    const isContinentSearch = (continentCode === "EU" || countryCode === "EU") && (!countryCode || countryCode === "EU");
    explanation = `Searching in the **${appliedArea}** region of ${isContinentSearch ? "Europe" : destCountryName}, I selected **${cityName} (${destIata})** for you.`;
  } else if (countryCode) {
    explanation = `Since you want to fly to **${destCountryName}**, I selected **${cityName} (${destIata})** for your search.`;
  } else if (continentCode === "EU" || countryCode === "EU") {
    explanation = `Looking for flights to **Europe**, I selected **${cityName} (${destIata})** for you.`;
  } else {
    explanation = `Selected **${cityName} (${destIata})** for your flight search.`;
  }

  return {
    destination_airport: destIata,
    explanation
  };
}
