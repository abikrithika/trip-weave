import { z } from "zod";

export const saveFlightSchema = z.object({
  flight_number: z.string().min(1),

  origin: z.string().length(3),

  destination: z.string().length(3),

  price: z.coerce.number().positive(),

  departure_time: z.string().datetime(),

  currency_id: z.number().int().optional().nullable(),
});
