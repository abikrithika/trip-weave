import mockFlights from "../data/mock-flights.json" with { type: "json" };
import dotenv from "dotenv";
dotenv.config();
// Allow toggling mock/live via environment variable DUFFEL_USE_MOCK
const USE_MOCK = process.env.DUFFEL_USE_MOCK
  ? String(process.env.DUFFEL_USE_MOCK).toLowerCase() === "true"
  : false; // default to live API
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
    // If something went wrong, optionally fall back to mock data when enabled
    if (USE_MOCK) {
      console.warn(
        "Duffel request failed; falling back to mock data:",
        error.message || error,
      );
      return mockFlights;
    }
    throw error;
  }
};
