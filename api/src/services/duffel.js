export const searchFlights = async (payload) => {
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
};
