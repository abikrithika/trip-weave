# Trip-Weave
Trip-Weave is an AI-powered travel planning and flight search application that allows users to search for flights using natural language. Instead of manually entering airport codes, dates, and passenger information, users can simply describe their travel plans in plain English.

The application uses an AI-powered extraction service (Groq) to convert user prompts into structured flight search parameters, which are then sent to the Duffel Flights API (or mock data during development). The project consists of a Node.js/Express backend, a lightweight frontend, PostgreSQL with Prisma ORM, and AI-assisted flight extraction.

## Features
- AI-powered flight search using natural language
- Flight parameter extraction with Groq LLM
- Flight search using the Duffel API
- Mock flight data fallback for offline development
- PostgreSQL database with Prisma ORM
- RESTful API architecture
- Frontend chat interface for flight search
- Automated extractor normalization tests
  
## Project Board

- Trello: https://trello.com/b/2veKRbtH/trip-weave
  
# Running the Project Locally

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
npm install request-ip

## Environment Variables

Create a `.env` file in the project root.

Example:

- PORT=5500
- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trip_weave
- GROQ_API_KEY=sk_your_actual_api_key_here
- GROQ_MODEL=openai/gpt-oss-20b
- JWT_SECRET=your_super_secret_key_here
- DUFFEL_API_URL="https://api.duffel.com"
- DUFFEL_TOKEN=your_duffel_secret_key_here
Add any additional environment variables required by the application.

If you need the Groq-specific setup details, see [api/src/groq/README.md](api/src/groq/README.md).

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

### Frontend

npm run start:frontend

### Run both frontend and backend together:

npm run standalone

### Backend:

http://localhost:5500

### Frontend:

http://localhost:8080

# Deliverables
## Deployed API
## API Base URL(When running locally)

http://localhost:5500 (Replace the port if configured differently in `.env`).
## Postman Collection

# Key Technical Summary & Design Decisions

- Built with Node.js and Express.js following a RESTful API architecture.
- Uses Prisma ORM for database management and migrations.
- PostgreSQL is used as the primary relational database.
- Flight search is powered by Duffel API, with automatic fallback to mock data for development and testing.
- AI flight extraction uses Groq to convert natural-language travel requests into structured JSON.
- Extracted flight requests are validated before search execution to reduce invalid API requests.
- The backend is organised into modular services, routes, controllers, and database layers for maintainability.
- Authentication and user accounts are implemented and managed using JWT.
- Environment variables are used for all API keys and configuration.
- Automated tests verify AI extraction and JSON normalization independently of external APIs.
- Limited user conversations are stored for authenticated users.
  
# Tech Stack
- Node.js
- Express.js
- PostgreSQL
- Prisma ORM
- Groq API
- Duffel API
- Nodemon
- JavaScript

# Future Improvements
- Hotel and activity recommendations
- Flight price alerts
- Enhanced filtering and sorting
- Better UI/UX and responsive design
- Comprehensive API documentation using Swagger
- Increased automated test coverage

# Contributors

| Name | GitHub Profile |
|------|----------------|
| **Abikrithika** | [@abikrithika](https://github.com/abikrithika) |
| **Annamani** | [@annamani](https://github.com/annamani) |
| **Priyo Arman** | [@priyoarman](https://github.com/priyoarman) |
| **Ftshn84** | [@ftshn84](https://github.com/ftshn84) |

# Sample Test flow
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
