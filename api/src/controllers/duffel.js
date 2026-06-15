import { searchFlights } from "../services/duffel.js";

export const searchFlightsController = async (req, res, next) => {
  try {
    const result = await searchFlights(req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
