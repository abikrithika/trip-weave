# Groq Flight Search Extraction

Extracts flight search queries from natural language using Groq API with Structured Outputs.

## Setup

1. **Check Node version:**

```bash
node -v  # Should be >= 18
```

2. **Set environment variables in `.env`:**

```bash
GROQ_API_KEY=sk_your_actual_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

3. **Install dependencies:**

```bash
npm install
```

## Test It

Run the test script:

```bash
npm run test:extract
```

Run the offline normalization test:

```bash
npm run test:extract:normalize
```

Or call the backend route:

```bash
POST /api/groq/extract
```

```json
{
  "prompt": "Find direct return flights from Copenhagen to Barcelona for 2 passengers from 2026-07-15 to 2026-07-22 under 2500 DKK with baggage included."
}
```

### Expected Output (Success)

```json
{
  "ok": true,
  "parsed": {
    "trip_type": "return",
    "origin_airport": "CPH",
    "destination_airport": "BCN",
    "departure_date": "2026-07-15",
    "return_date": "2026-07-22",
    "passengers": 2,
    "cabin_class": "economy",
    "currency": "DKK",
    "max_price_dkk": 2500,
    "vibe_tags": [],
    "filters": {
      "direct_only": true,
      "preferred_airlines": [],
      "baggage_required": true,
      "departure_time": null
    }
  },
  "errors": []
}
```

### Expected Output (Failure)

```json
{
  "ok": false,
  "parsed": null,
  "errors": ["error message here"]
}
```

## Quick Troubleshooting

| Issue              | Fix                                      |
| ------------------ | ---------------------------------------- |
| Module not found   | Run `npm install`                        |
| GROQ_API_KEY error | Add `GROQ_API_KEY=sk_...` to `.env`      |
| Network error      | Check internet and API key validity      |
| Parsing failed     | Check `raw` object in output for details |

## Files

- `extractor.js` - Main extraction function
- `systemPrompt.js` - System prompt for Groq
- `schema.json` - JSON Schema for validation
- `testExtract.js` - Test script
- `testNormalize.js` - Offline normalization test script
