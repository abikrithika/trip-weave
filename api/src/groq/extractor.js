import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createGroq } from "@ai-sdk/groq";
import SYSTEM_PROMPT from "./systemPrompt.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

export async function extractTripQuery(userText, opts = {}) {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
  const model = groq.languageModel(opts.modelId || process.env.GROQ_MODEL || "openai/gpt-oss-20b");

  try {
    const res = await model.doGenerate({
      prompt: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: [{ type: "text", text: userText }] },
      ],
      responseFormat: { type: "json" },
      maxOutputTokens: 1024,
    });

    const textPart = res.content.find(c => c.type === "text")?.text;
    if (!textPart) return { ok: false, errors: ["no_response"] };
    
    const parsed = JSON.parse(textPart);
    const valid = validate(parsed);
    
    if (!valid) return { ok: false, parsed, errors: validate.errors.map(e => e.message) };
    return { ok: true, parsed };
  } catch (err) {
    console.error("Extractor failure:", err);
    return { ok: false, errors: [err.message] };
  }
}