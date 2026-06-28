import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import apiRoutes from "./routers/api.js";
import { apiErrorHandler, apiNotFoundHandler } from "./middleware/errors.js";
import prisma from "./db/code/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();

app.use(cors());
app.use(express.json());

// 1. API Routes (Must come before static/catch-all)
app.use("/api", apiRoutes);
app.use("/api", apiNotFoundHandler);

// 2. Serve static files
app.use(express.static(path.resolve(__dirname, "../../app")));

// 3. Catch-all route for SPA (Single Page Application)
app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../../app/index.html"));
});

// 4. Global Error Handler
app.use(apiErrorHandler);

const PORT = process.env.PORT || 5050;

async function startServer() {
  await prisma.$connect();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
