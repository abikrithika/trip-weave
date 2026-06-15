import express from "express";
import { extractTripQueryController } from "../controllers/groq.js";

const router = express.Router();

router.post("/extract", extractTripQueryController);

export default router;
