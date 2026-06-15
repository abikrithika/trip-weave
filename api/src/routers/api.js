import express from "express";
import flightRoute from "./flights.js";
import groqRoute from "./groq.js";

const router = express.Router();

router.use("/flights", flightRoute);
router.use("/groq", groqRoute);

export default router;
