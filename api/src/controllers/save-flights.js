import prisma from "../db/code/prisma.js";
import { saveFlightSchema } from "../schemas/save-flight-schemas.js";
// GET /api/saved-flights
export async function getSaved(req, res, next) {
  try {
    const userId = Number(req.user?.user_id ?? 1);

    const flights = await prisma.savedOffer.findMany({
      where: {
        userId,
      },
      include: {
        currency: true,
      },
      orderBy: {
        departureTime: "asc",
      },
    });

    return res.status(200).json({
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

    const {
      flight_number,
      origin,
      destination,
      price,
      departure_time,
      currency_id,
    } = validation.data;

    const userId = Number(req.user?.user_id ?? 1);

    const existing = await prisma.savedOffer.findFirst({
      where: {
        userId,
        flightNumber: flight_number,
        departureTime: new Date(departure_time),
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Flight already saved",
      });
    }

    const savedFlight = await prisma.savedOffer.create({
      data: {
        userId,
        flightNumber: flight_number,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        price,
        currencyId: currency_id ?? null,
        departureTime: new Date(departure_time),
      },
    });

    return res.status(201).json({
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
    const { id } = req.params;

    const userId = Number(req.user?.user_id ?? 1);

    const flight = await prisma.savedOffer.findFirst({
      where: {
        id: BigInt(id),
        userId,
      },
    });

    if (!flight) {
      return res.status(404).json({
        success: false,
        message: "Flight not found",
      });
    }

    await prisma.savedOffer.delete({
      where: {
        id: BigInt(id),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Flight removed",
    });
  } catch (error) {
    next(error);
  }
}
