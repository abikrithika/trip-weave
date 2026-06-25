# trip-weave

## Prerequisites

Make sure you have the following installed:

- Node.js
- npm
- Git

Verify installation:

node -v
npm -v
git --version

## Installation

### 1. Clone the repository

git clone https://github.com/abikrithika/trip-weave.git
cd trip-weave

### 2. Install dependencies

npm install

### 3. Install Nodemon

npm install --save-dev nodemon
npm install -g concurrently
npm install -g http-server
npm install jsonwebtoken
npm install bcrypt

## Environment Variables

Create a `.env` file in the project root.

Example:

PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trip_weave
Add any additional environment variables required by the application.

## Package Scripts

Key scripts:

- `npm run dev`
- `npm start`
- `npm run test:extract:normalize`
- `npm run test:extract`

## Database Scripts

- `npm run db:create`: Ensures the PostgreSQL database exists before Prisma operations run.
- `npm run db:validate`: Validates Prisma schema and config (fails fast if schema or env is invalid).
- `npm run db:migrate`: Runs `prisma migrate dev` for local development.
- `npm run db:migrate -- --name <migration_name>`: Preferred migrate form so migration names are explicit and non-interactive.
- `npm run db:generate`: Regenerates Prisma Client from the current schema.
- `npm run db:seed`: Runs the seed runner (`api/src/db/code/seed.js`) and inserts seed data.
- `npm run db:deploy`: Runs `prisma migrate deploy` for non-development environments (applies existing migrations only).
- `npm run db:all`: Runs the full setup chain in order: create -> validate -> migrate -> generate -> seed.

Database files now live under `api/src/db/`, with code (Prisma schema, client, config, and seed runner) in `api/src/db/code/`, migrations in `api/src/db/migrations/`, and seed data in `api/src/db/seeds/`.

## Running the Project

### Development Mode (Nodemon)

npm run dev

Nodemon automatically restarts the server whenever changes are made.

### Production Mode

npm start

## API Base URL

When running locally:

http://localhost:5000 (Replace the port if configured differently in `.env`).

## Testing AI Flight JSON Extraction

The flight AI extractor lives in `api/src/groq/`. It turns a natural-language flight request into clean JSON for the backend.

### 1. Offline normalization test

This test does not call Groq and does not need an API key. It checks that messy AI-like data is cleaned into the expected shape.

```bash
npm run test:extract:normalize
```

Expected output:

```txt
AI flight JSON normalization tests passed.
```

### 2. Live Groq extraction test

Add these variables to `.env` first:

```env
GROQ_API_KEY=your_groq_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

Then run:

```bash
npm run test:extract
```

The output should include:

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

### 3. Test through the API

Start the backend:

```bash
npm run dev
```

Then send a request:

```bash
curl -X POST http://localhost:5050/api/groq/extract \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Find direct return flights from Copenhagen to Barcelona for 2 passengers from 2026-07-15 to 2026-07-22 under 2500 DKK with baggage included."}'
```

The API response wraps the extracted JSON in a `data` field:

```json
{
  "success": true,
  "data": {
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

## Tech Stack

- Node.js
- Express.js
- PostgresSql
- Nodemon

## Contributors

## Testing the extractor and AI search

Simple steps to test the extractor and the AI -> Duffel flow locally.

- Start the API server (development):

```bash
npm run dev
```

- Test the extractor endpoint (returns normalized JSON):

```bash
curl -s -X POST http://localhost:5050/api/groq/extract \
	-H "Content-Type: application/json" \
	-d '{"prompt":"Find a return flight from CPH to LHR departing 2026-07-15 returning 2026-07-22"}' | jq
```

- Test the AI flight search endpoint (uses extractor then Duffel/mock):

```bash
curl -s -X POST http://localhost:5050/api/flights/ai-search \
	-H "Content-Type: application/json" \
	-d '{"prompt":"Find a return flight from CPH to LHR departing 2026-07-15 returning 2026-07-22"}' | jq
```

- Notes:
  - If you want the extractor to call the Groq model, set `GROQ_API_KEY` in your environment.
  - The Duffel service falls back to mock data by default. Provide `DUFFEL_TOKEN` and set `USE_MOCK = false` inside `api/src/services/duffel.js` to test live Duffel responses.
  - The extractor validates `return_date` and will return errors like `invalid_return_date` or `return_before_departure_date` when applicable.
## Testing the Frontend (Live flight search)

This project includes a small frontend in the `app/` folder that calls the backend Groq extractor and Duffel bridge to search flights.

1. Start the backend (API + Groq bridge) and the frontend static server. From the project root:

```bash
# run the backend (nodemon)
npm run dev

# serve the frontend app (http-server)
npm run start:frontend

# or run both together
npm run standalone
```

2. Open the frontend in your browser (http-server default):

http://localhost:8080

3. Try example queries in the chat input (the app extracts flight details automatically):

- "Return flight from LHR to JFK July 20th July 27th"
- "One-way from CPH to BCN July 15th"
- "Find 2 passengers, roundtrip Copenhagen to Barcelona July 15 to July 22 with baggage"

What the frontend sends to the backend

- The frontend builds a Duffel-style payload including `slices`, `passengers`, and `cabin_class`.
- For return trips the frontend now sends two slices (outbound then return). Example payload sent to `/api/flights/search`:

```json
{
  "slices": [
    { "origin": "LHR", "destination": "JFK", "departure_date": "2026-07-20" },
    { "origin": "JFK", "destination": "LHR", "departure_date": "2026-07-27" }
  ],
  "passengers": [{ "type": "adult" }, { "type": "adult" }],
  "cabin_class": "economy"
}
```

Expected API response shape

- The backend returns the Duffel response (or mock data) under `data` with an `offers` array. Each offer contains `total_amount`, `total_currency`, `owner`, and `slices` (with times/duration).

Example (simplified):

```json
{
  "success": true,
  "data": {
    "offers": [
      {
        "id": "off_1",
        "total_amount": "249.00",
        "total_currency": "USD",
        "owner": { "name": "SkyJet Airlines" },
        "slices": [
          {
            "origin": "JFK",
            "destination": "LAX",
            "departure_time": "2026-06-20T08:00:00Z",
            "arrival_time": "2026-06-20T11:15:00Z"
          }
        ]
      }
    ]
  }
}
```

What you should see in the browser (expected frontend output)

- A list of flight cards showing:
  - Route(s): `ORIGIN → DESTINATION` for each slice (multiple legs separated by `|`).
  - Airline / owner name.
  - Price and currency (e.g. `249.00 USD`).
  - For each leg: departure time, arrival time, number of stops and duration when available.

Offline / mock fallback

- If the backend cannot reach Duffel (or you are offline), the frontend falls back to `backupDatabase` or the server returns `api/src/data/mock-flights.json`. You will see mock cards with route, price, and times.

Debugging tips

- To inspect the exact payload the frontend sends, open the browser DevTools Network tab and look for the POST to `/api/groq/extract` and `/api/flights/search`.
- To simulate the backend without Duffel credentials, set `USE_MOCK` in `api/src/services/duffel.js` or rely on the mock file at `api/src/data/mock-flights.json`.
