import fs from "fs";
import path from "path";
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

async function extractTripQuery(userText, opts = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  const groq = createGroq({ apiKey });
  const modelId = opts.modelId || DEFAULT_MODEL;
  const model = groq.languageModel(modelId);

  const prompt = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: [{ type: "text", text: userText }] },
  ];

  const responseFormat = { type: "json", schema };

  const res = await model.doGenerate({
    prompt,
    responseFormat,
    maxOutputTokens: 512,
  });

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

  // Validate against schema
  const valid = validate(parsed);
  if (!valid) {
    result.errors.push(
      ...(validate.errors || []).map((e) => `${e.instancePath} ${e.message}`),
    );
    result.parsed = parsed;
    return result;
  }

  result.ok = true;
  result.parsed = parsed;
  return result;
}

export { extractTripQuery };
