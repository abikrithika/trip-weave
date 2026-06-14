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
node api/src/groq/testExtract.js
```

### Expected Output (Success)

```json
{
  "ok": true,
  "parsed": {
    "origin_airport": "CPH",
    "destination_airport": "LHR",
    "departure_date": "2026-07-15",
    "max_price_dkk": 1200,
    "vibe_tags": ["beach", "chill"],
    "validation_error": null
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
