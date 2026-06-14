import dotenv from "dotenv";
import { extractTripQuery } from "./extractor.js";

dotenv.config();

const input =
  "Looking for cheap flights from Denmark to Finland on 2026-07-15. Vibe: cold, cozyness, city life.";

try {
  const res = await extractTripQuery(input, {
    modelId: process.env.GROQ_MODEL,
  });
  console.log(JSON.stringify(res, null, 2));
} catch (err) {
  console.error("Test run failed:", err);
  process.exitCode = 1;
}
