import prisma from "../db/code/prisma.js";
import { saveFlightSchema } from "../schemas/save-flight-schemas.js";

// GET /api/saved-flights
export async function getSaved(req, res, next) {
  try {
    const user_id = req.user.id;

    const flights = await prisma.saved_offers.findMany({
      where: {
        user_id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      flights,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/saved-flights
export async function saveFlight(req, res, next) {
  try {
    const validation = saveFlightSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        errors: validation.error.flatten().fieldErrors,
      });
    }
    const { flight_number, origin, destination, price, departure_time } =
      validation.data;
    const user_id = Number(req.user.user_id);
    const existing = await prisma.saved_offers.findFirst({
      where: {
        user_id,
        origin,
        destination,
        price,
      },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Flight already saved",
      });
    }
    const savedFlight = await prisma.saved_offers.create({
      user_id,
      flight_number: flight_number ?? null,
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      price,
      departure_time: departure_time ? new Date(departure_time) : null,
    });

    res.status(201).json({
      success: true,
      flight: savedFlight,
    });
  } catch (error) {
    next(error);
  }
}
// DELETE /api/saved-flights/:id
export async function removeFlight(req, res, next) {
  try {
    const user_id = req.user.user_id;
    const { id } = req.params.id;
    const flight = await prisma.saved_offers.findFirst({
      where: {
        id,
        user_id,
      },
    });
    if (!flight) {
      return res.status(404).json({
        success: false,
        message: "Flight not found",
      });
    } else {
      await prisma.saved_offers.delete({
        where: {
          user_id,
        },
      });
    }
    res.status(200).json({
      success: true,
      message: "Flight removed",
    });
  } catch (error) {
    next(error);
  }
}
