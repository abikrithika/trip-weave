import dotenv from "dotenv";
import { extractTripQuery } from "./extractor.js";

dotenv.config();

const input =
  "Denmark to Spain, 15th to 30th July, 3000 DKK, beach vibes only, no parties, prefer direct flights";

try {
  const res = await extractTripQuery(input, {
    modelId: process.env.GROQ_MODEL,
  });
  console.log(JSON.stringify(res, null, 2));
} catch (err) {
  console.error("Test run failed:", err);
  process.exitCode = 1;
}
