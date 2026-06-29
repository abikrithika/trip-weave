import prisma from "../db/code/prisma.js";
import { saveFlightSchema } from "../schemas/save-flight-schemas.js";
import { serialize } from "../utils/serialize.js";

export async function getSaved(req, res, next) {
  try {
    const rawUserId = req.user?.userId;

    if (rawUserId === undefined || rawUserId === null || rawUserId === "") {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = typeof rawUserId === "bigint" ? rawUserId : BigInt(rawUserId);

    const flights = await prisma.savedOffer.findMany({
      where: { userId },
      include: { currency: true },
      orderBy: { departureTime: "asc" },
    });

    return res.status(200).json({
      success: true,
      flights: serialize(flights),
    });
  } catch (error) {
    next(error);
  }
}
export async function saveFlight(req, res, next) {
  try {
    const rawUserId = req.user?.userId;

    if (rawUserId === undefined || rawUserId === null || rawUserId === "") {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = typeof rawUserId === "bigint" ? rawUserId : BigInt(rawUserId);

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

    if (currency_id) {
      const currency = await prisma.currency.findUnique({
        where: { id: currency_id },
      });

      if (!currency) {
        return res.status(400).json({
          success: false,
          message: "Invalid currency_id",
        });
      }
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
      flight: serialize(savedFlight),
    });
  } catch (error) {
    next(error);
  }
}

export async function removeFlight(req, res, next) {
  try {
    const rawUserId = req.user?.userId;

    if (rawUserId === undefined || rawUserId === null || rawUserId === "") {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = typeof rawUserId === "bigint" ? rawUserId : BigInt(rawUserId);
    const id = BigInt(req.params.id);

    const flight = await prisma.savedOffer.findFirst({
      where: { id, userId },
    });

    if (!flight) {
      return res.status(404).json({
        success: false,
        message: "Flight not found",
      });
    }

    await prisma.savedOffer.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Flight removed",
    });
  } catch (error) {
    next(error);
  }
}
