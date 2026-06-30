import express from "express";
import { aiFlightSearchController } from "../controllers/aiFlights.js";
import { flightSearchStreamController } from "../controllers/flightSearchStream.js";
import { searchFlightsController } from "../controllers/duffel.js";
import {validate} from "../middleware/validate-data.js";
import {searchFlightsSchema} from "../schemas/flight-schemas.js";

const router = express.Router();
router.post("/search-stream", flightSearchStreamController);
router.post("/ai-search", aiFlightSearchController);
router.post("/search", validate(searchFlightsSchema), searchFlightsController,);
export default router;
