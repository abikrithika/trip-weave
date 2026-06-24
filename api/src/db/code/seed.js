import { pathToFileURL } from "url";
import { readFile } from "fs/promises";
import prisma from "./prisma.js";
import bcrypt from "bcryptjs";

async function loadJsonSeed(fileName) {
    const filePath = new URL(`../seeds/${fileName}`, import.meta.url);
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
}

export async function seedCurrencies() {
    const currencySeeds = await loadJsonSeed("currencies.json");

    const results = [];

    for (const currency of currencySeeds) {
        const record = await prisma.currency.upsert({
            where: { code: currency.code },
            update: {
                name: currency.name,
                symbol: currency.symbol,
            },
            create: currency,
        });

        results.push(record);
    }

    return results;
}

export async function seedUsers() {
    const userSeeds = await loadJsonSeed("users.json");
    const currencies = await prisma.currency.findMany();
    const currencyByCode = new Map(currencies.map((currency) => [currency.code, currency.id]));
    const results = [];

    for (const user of userSeeds) {
        const currencyCode = user.currencyCode || "DKK";
        const currencyId = currencyByCode.get(currencyCode) || null;

        const record = await prisma.user.upsert({
            where: { email: user.email },
            update: {
                name: user.name,
                passwordHash: bcrypt.hashSync(user.passwordHash),
                currencyId,
            },
            create: {
                name: user.name,
                email: user.email,
                passwordHash: bcrypt.hashSync(user.passwordHash),
                currencyId,
            },
        });

        results.push(record);
    }

    return results;
}

const seedTasks = [
    {
        name: "currencies",
        run: seedCurrencies,
    },
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
