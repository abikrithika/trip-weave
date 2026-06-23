import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import apiRoutes from "./routers/api.js";
import prisma from "./db/code/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", apiRoutes);

app.use(express.static(path.join(__dirname, "../../app")));

app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "../../app/index.html"));
});

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