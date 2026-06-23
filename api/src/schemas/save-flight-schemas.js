import { z } from "zod";

export const saveFlightSchema = z.object({
  flight_number: z.string().optional().nullable(),
  origin: z
    .string()
    .min(3, "Origin airport is required")
    .max(3, "Use IATA code"),

  destination: z
    .string()
    .min(3, "Destination airport is required")
    .max(3, "Use IATA code"),

  price: z.coerce.number().positive("Price must be positive"),
  departure_time: z.string().datetime().optional().nullable(),
});
