import { pathToFileURL } from "url";
import { readFile } from "fs/promises";
import prisma from "./prisma.js";

async function loadJsonSeed(fileName) {
    const filePath = new URL(`../seeds/${fileName}`, import.meta.url);
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
}

export async function seedUsers() {
    const userSeeds = await loadJsonSeed("users.json");
    const results = [];

    for (const user of userSeeds) {
        const record = await prisma.user.upsert({
            where: { email: user.email },
            update: {
                passwordHash: user.passwordHash,
                preferredCurrency: user.preferredCurrency,
            },
            create: user,
        });

        results.push(record);
    }

    return results;
}

const seedTasks = [
    {
        name: "users",
        run: seedUsers,
    },
];

export async function runAllSeeds() {
    const summary = [];

    for (const task of seedTasks) {
        const records = await task.run();
        summary.push({ name: task.name, count: records.length });
    }

    return summary;
}

async function main() {
    try {
        const summary = await runAllSeeds();

        for (const item of summary) {
            console.log(`Seeded ${item.count} ${item.name}.`);
        }
    } finally {
        await prisma.$disconnect();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error("Failed to run seeds", error);
        process.exit(1);
    });
}