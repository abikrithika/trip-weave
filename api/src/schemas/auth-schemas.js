import z from "zod";

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required"), // <-- Added this line
  email: z.string().email().toLowerCase(),
  password: z.string().min(8),
});

//Login schema
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});