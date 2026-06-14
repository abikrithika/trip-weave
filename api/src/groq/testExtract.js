require("dotenv").config();
const { extractTripQuery } = require("./extractor");

(async () => {
  const input =
    "Looking for cheap flights from CPH to DAC on 2026-07-15. Max 5200 DKK. Vibe: beach, chill.";
  try {
    const res = await extractTripQuery(input, {
      modelId: process.env.GROQ_MODEL,
    });
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Test run failed:", err);
    process.exitCode = 1;
  }
})();
