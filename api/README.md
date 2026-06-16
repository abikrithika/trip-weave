# Search flights using Duffel (POST)

# How to test this endpoint using POSTMAN

- POST http://localhost:5000/api/flights/search
- test data in body
  Example:
```json
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
```
- Click Send
- Check the output

# How to test with mock-flights data
- POST http://localhost:5000/api/flights/search
- test data in body
- Example:
```json
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
```
- Click Send 
- Check that the output(JSON data) matches the mock-flights data, which was created in a JSON file.

