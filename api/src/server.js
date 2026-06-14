import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { extractTripQuery } from "./groq/extractor.js";

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
  if (!text) {
    return res.status(400).json({ ok: false, errors: ["Missing user text"] });
  }

  try {
    const result = await extractTripQuery(text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, errors: [error.message] });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
