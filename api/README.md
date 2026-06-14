# Search flights using Duffel (POST)

# How to test this endpoint using POSTMAN

- POST http://localhost:5000/api/flights/search
- test data in body
  Example:
  {
  "data": {
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
  }
- Click Send
- Check the output
