import dotenv from "dotenv";
import { extractTripQuery } from "./extractor.js";

dotenv.config();

const input =
  "Find direct return flights from Copenhagen to Barcelona for 2 passengers from 2026-07-15 to 2026-07-22 under 2500 DKK with baggage included.";

try {
  const res = await extractTripQuery(input, {
    modelId: process.env.GROQ_MODEL,
  });
  console.log(JSON.stringify(res, null, 2));
} catch (err) {
  console.error("Test run failed:", err);
  process.exitCode = 1;
}
