import express from "express";
import { searchFlightsController } from "../controllers/duffel.js";

const router = express.Router();

router.post("/search", searchFlightsController);

export default router;
