import dotenv from "dotenv";
import { defineConfig } from "prisma/config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../../..");

dotenv.config({ path: path.resolve(projectRoot, ".env") });

export default defineConfig({
  schema: "./schema.prisma",
  migrations: {
    path: "../migrations",
    seed: "node api/src/db/code/seed.js",
  },
});