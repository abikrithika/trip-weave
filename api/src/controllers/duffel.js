import { searchFlights } from "../services/duffel.js";

export const searchFlightsController = async (req, res) => {
  try {
    const result = await searchFlights(req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Duffel error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
