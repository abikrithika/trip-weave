import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import { fileURLToPath } from "url";
import { createGroq } from "@ai-sdk/groq";
import SYSTEM_PROMPT from "./systemPrompt.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, "schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const DEFAULT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

function safeParseJsonMaybe(text) {
  if (!text || typeof text !== "string") return null;
  // Try direct JSON parse
  try {
    return JSON.parse(text);
  } catch (e) {
    // try to extract first JSON block in text
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

function normalizeIataCode(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return value;
  return value.trim().toUpperCase();
}

function normalizeCurrency(value) {
  if (value == null || value === "") return "DKK";
  if (typeof value !== "string") return value;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : value;
}

function normalizeTripType(value, returnDate) {
  if (returnDate) return "return";
  if (typeof value !== "string" || value.trim() === "") return "one_way";

  const normalized = value.trim().toLowerCase().replace(/[-\s]/g, "_");
  if (["return", "round_trip", "roundtrip"].includes(normalized))
    return "return";
  if (["one_way", "oneway", "single"].includes(normalized)) return "one_way";

  return value;
}

function normalizeCabinClass(value) {
  if (value == null || value === "") return "economy";
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase().replace(/[-\s]/g, "_");
  const aliases = {
    premium: "premium_economy",
    premium_economy: "premium_economy",
    economy: "economy",
    business: "business",
    first: "first",
    first_class: "first",
  };

  return aliases[normalized] || value;
}

function normalizePassengers(value) {
  if (value == null || value === "") return 1;
  if (Number.isInteger(value)) return value;
  if (typeof value === "number" && Number.isFinite(value))
    return Math.round(value);
  if (typeof value !== "string") return value;

  const parsed = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : value;
}

function normalizeMaxPriceDkk(value) {
  if (value == null || value === "") return null;
  if (Number.isInteger(value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value !== "string") return value;

  const cleaned = value.trim().replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  const normalized = cleaned
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(/,(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? Math.round(parsed) : value;
}

function normalizeVibeTags(value) {
  if (value == null || value === "") return [];

  const tags = Array.isArray(value) ? value : String(value).split(/[,\n]/);

  return tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : String(tag).trim()))
    .filter(Boolean);
}

function normalizeBoolean(value) {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase();
  if (
    ["true", "yes", "y", "only", "direct", "nonstop", "non-stop"].includes(
      normalized,
    )
  ) {
    return true;
  }
  if (["false", "no", "n"].includes(normalized)) {
    return false;
  }
  return value;
}

function normalizePreferredAirlines(value) {
  if (value == null || value === "") return [];
  const airlines = Array.isArray(value) ? value : String(value).split(/[,\n]/);

  return airlines.map((airline) => String(airline).trim()).filter(Boolean);
}

function normalizeDepartureTime(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase();
  if (["morning", "afternoon", "evening", "night"].includes(normalized)) {
    return normalized;
  }

  return value;
}

function normalizeFilters(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    direct_only: normalizeBoolean(source.direct_only),
    preferred_airlines: normalizePreferredAirlines(source.preferred_airlines),
    baggage_required: normalizeBoolean(source.baggage_required),
    departure_time: normalizeDepartureTime(source.departure_time),
  };
}

function normalizeTripQuery(raw) {
const source = raw && typeof raw === "object" ? raw : {};
  const tomorrow = new Date();

  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowDateStr = tomorrow.toISOString().split('T')[0];

  return {

  origin_airport: normalizeIataCode(source.origin_airport) || null,
    destination_airport: normalizeIataCode(source.destination_airport) || null,

    departure_date: source.departure_date || null,
    
    trip_type: normalizeTripType(source.trip_type, source.return_date),
    return_date: source.return_date || null,
    max_price_dkk: source.max_price_dkk || null,
    vibe_tags: source.vibe_tags || [],
    // Flattened filter keys matching the new schema
    direct_only: normalizeBoolean(source.direct_only),
    preferred_airlines: normalizePreferredAirlines(source.preferred_airlines),
    baggage_required: normalizeBoolean(source.baggage_required),
    departure_time: normalizeDepartureTime(source.departure_time)
  };
}

function isRealDateString(value) {
  if (value == null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function verifyTripQuery(query) {
  const errors = [];

  /*if (!query.origin_airport) {
    errors.push("missing_origin_airport");
  }
  if (!query.destination_airport) {
    errors.push("missing_destination_airport");
  }
  if (!query.departure_date) {
    errors.push("missing_departure_date");
  } else if (!isRealDateString(query.departure_date)) {
    errors.push("invalid_departure_date");
  }
  if (query.return_date && !isRealDateString(query.return_date)) {
    errors.push("invalid_return_date");
  }
  if (query.trip_type === "return" && !query.return_date) {
    errors.push("missing_return_date");
  }
  if (
    query.departure_date &&
    query.return_date &&
    isRealDateString(query.departure_date) &&
    isRealDateString(query.return_date) &&
    query.return_date < query.departure_date
  ) {
    errors.push("return_date_before_departure_date");
  }*/

  return errors;
}

async function extractTripQuery(userText, opts = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  const groq = createGroq({ apiKey });
  const modelId = opts.modelId || DEFAULT_MODEL;
  const model = groq.languageModel(modelId);

  const prompt = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: [{ type: "text", text: userText }] },
  ];

  // AI SDK maps this to Groq/OpenAI Structured Outputs:
  // response_format: { type: "json_schema", json_schema: { ... } }
  const structuredOutputFormat = {
    type: "json",
    name: "trip_query_extraction",
    description: "Extract a flight search query from natural language.",
    schema,
  };

  let res;
  try {
    res = await model.doGenerate({
      prompt,
      responseFormat: structuredOutputFormat,
      // increase token budget so the model has more room to emit valid JSON
      maxOutputTokens: 1024,
    });
  } catch (err) {
    console.error("Groq generation failed:", err?.message || err);
    return {
      ok: false,
      parsed: null,
      errors: ["failed_generation", err?.message || String(err)],
    };
  }

  // Try to parse JSON from the returned content
  let parsed = null;
  if (Array.isArray(res.content) && res.content.length > 0) {
    // find first text part
    const textPart = res.content.find((c) => c.type === "text");
    if (textPart && textPart.text) {
      parsed = safeParseJsonMaybe(textPart.text);
    }
  }

  // fallback: try raw response body
  if (!parsed && res.response && res.response.body) {
    try {
      if (typeof res.response.body === "string") {
        parsed = safeParseJsonMaybe(res.response.body);
      } else if (typeof res.response.body === "object") {
        // sometimes provider puts parsed result here
        parsed = res.response.body;
      }
    } catch (e) {
      parsed = null;
    }
  }

  const result = {
    ok: false,
    parsed: null,
    errors: [],
  };

  if (!parsed) {
    result.errors.push("failed_to_parse_json_from_model_response");
    return result;
  }

  // --- PRE-NORMALIZATION FIX ---
  // Ensure vibe_tags is always treated as an array before validation.
  if (parsed.vibe_tags && typeof parsed.vibe_tags === "string") {
    parsed.vibe_tags = [parsed.vibe_tags];
  }
  // -----------------------------

  parsed = normalizeTripQuery(parsed);

parsed.trip_type = normalizeTripType(parsed.trip_type, parsed.return_date);
  parsed.vibe_tags = parsed.vibe_tags || [];
  parsed.max_price_dkk = parsed.max_price_dkk || null;
  parsed.return_date = parsed.return_date || null;
  parsed.departure_date = parsed.departure_date || null;

parsed.direct_only = parsed.direct_only ?? null;
  parsed.preferred_airlines = parsed.preferred_airlines || [];
  parsed.baggage_required = parsed.baggage_required ?? null;
  parsed.departure_time = parsed.departure_time || null;

 const verificationErrors = verifyTripQuery(parsed);
  if (verificationErrors.length > 0) {
    result.errors.push(...verificationErrors);
    result.parsed = parsed;
    return result;
  }

  result.ok = true;
  result.parsed = parsed;
  return result;
}

export {
  extractTripQuery,
  normalizeTripQuery,
  isRealDateString,
  verifyTripQuery,
};
//End of file