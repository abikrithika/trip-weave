import express from "express";
import { signUp, logIn } from "../controllers/auth.js";

const authRouter = express.Router();

authRouter.post("/signup", signUp);
authRouter.post("/login", logIn);
export default authRouter;
