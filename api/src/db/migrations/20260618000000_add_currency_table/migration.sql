-- CreateTable
CREATE TABLE "public"."currencies" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "public"."currencies"("code");

-- Seed baseline currencies
INSERT INTO "public"."currencies" ("code", "name", "symbol")
VALUES
    ('DKK', 'Danish Krone', 'kr'),
    ('EUR', 'Euro', 'EUR'),
    ('USD', 'US Dollar', '$'),
    ('GBP', 'British Pound', 'GBP')
ON CONFLICT ("code") DO NOTHING;

-- AlterTable users
ALTER TABLE "public"."users"
ADD COLUMN "currency_id" INTEGER;

-- Backfill users currency_id from existing preferred_currency values
UPDATE "public"."users" AS u
SET "currency_id" = c."id"
FROM "public"."currencies" AS c
WHERE c."code" = UPPER(COALESCE(u."preferred_currency", 'DKK'));

-- Remove deprecated preferred currency column from users
ALTER TABLE "public"."users"
DROP COLUMN "preferred_currency";

-- CreateIndex
CREATE INDEX "users_currency_id_idx" ON "public"."users"("currency_id");

-- AddForeignKey
ALTER TABLE "public"."users"
ADD CONSTRAINT "users_currency_id_fkey"
FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable saved_offers
ALTER TABLE "public"."saved_offers"
ADD COLUMN "currency_id" INTEGER;

-- Rename legacy price column
ALTER TABLE "public"."saved_offers"
RENAME COLUMN "price_dkk" TO "price";

-- Backfill saved_offers currency_id from user preferred currency
UPDATE "public"."saved_offers" AS s
SET "currency_id" = c."id"
FROM "public"."users" AS u
JOIN "public"."currencies" AS c ON c."id" = u."currency_id"
WHERE s."user_id" = u."id";

-- CreateIndex
CREATE INDEX "saved_offers_currency_id_idx" ON "public"."saved_offers"("currency_id");

-- AddForeignKey
ALTER TABLE "public"."saved_offers"
ADD CONSTRAINT "saved_offers_currency_id_fkey"
FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
