Search flights using Duffel (POST)

Search flights from an AI prompt (Groq + Duffel)

POST http://localhost:5050/api/flights/ai-search

test data in body
Example:

{
"prompt": "Find me a flight from Copenhagen to London on 2026-07-15"
}

The endpoint extracts the trip query with Groq, converts it to a Duffel payload, then searches flights.

The response includes:

query: the extracted Groq result

duffelPayload: the request sent to Duffel

data: the Duffel response

How to test this endpoint using POSTMAN

POST http://localhost:5050/api/flights/search

test data in body
Example:

{
"slices": [
{
"origin": "DEL",
"destination": "BKK",
"departure_date": "2026-11-28"
},
{
"origin": "BKK",
"destination": "DEL",
"departure_date": "2027-01-02"
}
],
"passengers": [
{
"type": "adult"
},
{
"age": 28
}
],
"cabin_class": "economy"
}

Click Send

Check the output

How to test with mock-flights data

POST http://localhost:5050/api/flights/search

test data in body

Example:

{
"slices": [
{
"origin": "DOH",
"destination": "NBO",
"departure_date": "2026-06-20"
},
{
"origin": "NBO",
"destination": "DOH",
"departure_date": "2026-06-27"
}
],
"passengers": [
{
"type": "adult"
}
],
"cabin_class": "economy"
}

Click Send

Check that the output(JSON data) matches the mock-flights data, which was created in a JSON file.

To test Authentication

Install dependencies using:

npm install bcrypt jsonwebtoken
npm install bcryptjs

API Endpoints

POST /api/auth/signup - Creates a new user.

{
"email": "user@example.com",
"password": "password123"
}

POST /api/auth/login - Authenticates an existing user and returns a JWT token.

{
"email": "user@example.com",
"password": "password123"
}

# How to test Saved-flights using POSTMAN

## Save Flight

- Login as user with email and password
- copy the Token
  Follow the below steps to test the flow
- POST http://localhost:5050/api/saved-flights/save
- Navigate to authentication select header as beare Token and Paste the copied token
- Navigate to Body- JSON

### Body

{
"flight_number": "LH210",
"origin": "FRA",
"destination": "JFK",
"price": 3100,
"departure_time": "2026-09-10T18:45:00Z",
"currency_id": 1
}

### Response

{
"success": true,
"flight": {
"id": "6",
"userId": "3",
"flightNumber": "LH210",
"origin": "FRA",
"destination": "JFK",
"price": "3100",
"currencyId": 1,
"departureTime": "2026-09-10T18:45:00.000Z"
}
}

# View Saved Flights

GET http://localhost:5050/api/saved-flights/saved

### Response

{
"success": true,
"flights": [
{
"id": "4",
"userId": "3",
"flightNumber": "KL330",
"origin": "AMS",
"destination": "CPH",
"price": "400",
"currencyId": 3,
"departureTime": "2027-07-22T12:00:00.000Z",
"currency": {
"id": 3,
"code": "USD",
"name": "US Dollar",
"symbol": "$"
}
}
]
}

# Delete Flight

DELETE http://localhost:5050/api/saved-flights/save/:id

### Response

{
"success": true,
"message": "Flight removed"
}
