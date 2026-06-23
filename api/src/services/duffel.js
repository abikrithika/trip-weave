import mockFlights from "../data/mock-flights.json" with { type: "json" };
import dotenv from "dotenv";
dotenv.config();
const USE_MOCK = true;
const BASE_API_URL = process.env.DUFFEL_API_URL || "https://api.duffel.com";
export const searchFlights = async (payload) => {
  try {
    const response = await fetch(`${BASE_API_URL}/air/offer_requests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DUFFEL_TOKEN}`,
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: payload,
      }),
    });

    const responseBody = await response.json();
    if (!response.ok) {
      throw new Error(JSON.stringify(responseBody));
    }
    return responseBody;
  } catch (error) {
    if (USE_MOCK) {
      console.log(
        "Duffel request failed. Using mock data. Error:",
        error.message,
      );
      return mockFlights;
    }
    throw error;
  }
};
