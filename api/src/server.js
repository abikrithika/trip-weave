import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import apiRoutes from "./routers/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();

app.use(express.json());

app.use("/api", apiRoutes);

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
