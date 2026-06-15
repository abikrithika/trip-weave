// import mockFlights from "../data/mock-flights.json" assert { type: "json" };
// export const searchFlights = async (payload) => {
//   try {
//     const response = await fetch("https://api.duffel.com/air/offer_requests", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${process.env.DUFFEL_TOKEN}`,
//         "Duffel-Version": "v2",
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(payload),
//     });

//     const responseBody = await response.json();
//     if (!response.ok) {
//       const error = new Error(
//         responseBody?.errors?.[0]?.title ?? "Failed to retrieve flight offers",
//       );
//       error.status = response.status;
//       throw error;
//     }
//     return responseBody;
//   } catch (error) {
//     console.warn(
//       "Duffel unavailable, serving mock flight data:",
//       error.message,
//     );

//     return mockFlights;
//   }
// };
import mockFlights from "../data/mock-flights.json" with { type: "json" };

const USE_MOCK = true;
export const searchFlights = async (payload) => {
  if (USE_MOCK) {
    console.log(" Using MOCK flights data");
    return mockFlights;
  }

  try {
    const response = await fetch("https://api.duffel.com/air/offer_requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DUFFEL_TOKEN}`,
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(responseBody));
    }

    return responseBody;
  } catch (error) {
    console.log("Duffel failed, using mock fallback");
    return mockFlights;
  }
};