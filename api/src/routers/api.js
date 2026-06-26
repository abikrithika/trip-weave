import express from "express";
import flightRoute from "./flights.js";
import groqRoute from "./groq.js";
import authRouter from "./auth.js";
import saveflightRoute from "./saved-flights.js";
import conversationRoute from "./conversations.js";

const router = express.Router();

router.use("/flights", flightRoute);
router.use("/groq", groqRoute);
router.use("/auth", authRouter);
router.use("/saved-flights", saveflightRoute);
router.use("/conversations", conversationRoute);

export default router;
