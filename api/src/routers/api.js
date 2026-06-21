import express from "express";
import flightRoute from "./flights.js";
import groqRoute from "./groq.js";
import authRouter from "./auth.js";

const router = express.Router();

router.use("/flights", flightRoute);
router.use("/groq", groqRoute);
router.use("/auth", authRouter);

export default router;
