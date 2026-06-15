import dotenv from "dotenv";
import { Client } from "pg";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

function escapeIdentifier(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
}

export async function ensureDatabaseExists(databaseUrl) {
    if (!databaseUrl) {
        throw new Error("DATABASE_URL is not set");
    }

    const parsed = new URL(databaseUrl);
    const dbName = parsed.pathname.replace(/^\//, "");

    if (!dbName) {
        throw new Error("DATABASE_URL must include a database name");
    }

    const adminUrl = new URL(databaseUrl);
    adminUrl.pathname = "/postgres";

    const client = new Client({ connectionString: adminUrl.toString() });

    try {
        await client.connect();
        const lookup = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);

        if (lookup.rowCount === 0) {
            await client.query(`CREATE DATABASE ${escapeIdentifier(dbName)}`);
            console.log(`Created database: ${dbName}`);
        }
    } finally {
        await client.end();
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
    await ensureDatabaseExists(process.env.DATABASE_URL);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error("Failed to ensure database exists", error);
        process.exit(1);
    });
}