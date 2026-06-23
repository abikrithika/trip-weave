import { z } from "zod";
// Validate search flights payload data
export const searchFlightsSchema = z.object({
  slices: z.array(
    z.object({
      origin: z.string(),
      destination: z.string(),
      departure_date: z.string(),
    }),
  ),
  passengers: z.array(
    z.object({
      type: z.enum(["adult", "child", "infant"]),
    }),
  ),
  cabin_class: z.string(),
});
