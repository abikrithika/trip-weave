import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { executeTripExtraction } from "./groq/executor.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to the TripWeave API! The server is running.");
});

app.post("/api/extract-trip", async (req, res) => {
  const { text } = req.body;

  try {
    const result = await executeTripExtraction(text);

    // Send appropriate status code based on result
    const statusCode = result.ok ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      parsed: null,
      errors: [error instanceof Error ? error.message : String(error)],
      rawInput: text,
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
