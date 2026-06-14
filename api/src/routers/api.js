import express from "express";
import flightRoute from "./flights.js";

const router = express.Router();

router.use("/flights", flightRoute);

export default router;
