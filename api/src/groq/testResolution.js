import dotenv from "dotenv";
dotenv.config();
import { extractTripQuery } from "./extractor.js";

async function runTest(queryText) {
  console.log(`\n========================================`);
  console.log(`TESTING QUERY: "${queryText}"`);
  console.log(`========================================`);
  try {
    const result = await extractTripQuery(queryText);
    if (!result.ok) {
      console.error("❌ Extraction failed:", result.errors);
      return;
    }
    console.log("SUCCESS!");
    console.log("Parsed result:", JSON.stringify(result.parsed, null, 2));
  } catch (err) {
    console.error("❌ Test error:", err);
  }
}

async function main() {
  await runTest("Flights to India next weekend");
  await new Promise(r => setTimeout(r, 25000));
  await runTest("Flights to South India next weekend");
  await new Promise(r => setTimeout(r, 25000));
  await runTest("Flights to south of Spain next weekend");
  await new Promise(r => setTimeout(r, 25000));
  await runTest("somewhere with beaches next weekend");
  await new Promise(r => setTimeout(r, 25000));
  await runTest("somewhere cozy in Europe");
}

main().catch(console.error);
