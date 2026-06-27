import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import apiRoutes from "./routers/api.js";
import prisma from "./db/code/prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
app.use(cors());
app.use(express.json());

// Log incoming requests
app.use((req, res, next) => { console.log(`[${req.method}] ${req.url}`); next(); });

// Routes
app.use("/api", apiRoutes);

// Error Handling (Must be after routes)
app.use((err, req, res, next) => {
  console.error("BACKEND ERROR:", err);
  res.status(500).json({ success: false, message: err.message });
});

// Static + Catch-all
app.use(express.static(path.join(__dirname, "../../app")));
app.get(/(.*)/, (req, res) => res.sendFile(path.join(__dirname, "../../app/index.html")));

const PORT = process.env.PORT || 5050;
await prisma.$connect();
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));