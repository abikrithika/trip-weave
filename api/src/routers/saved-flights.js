import express from "express";
import {
  getSaved,
  saveFlight,
  removeFlight,
} from "../controllers/save-flights.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();
router.get("/saved", authMiddleware, getSaved);
router.post("/save", saveFlight);
router.delete("/save/:id", authMiddleware, removeFlight);
export default router;
