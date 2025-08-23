-- CreateEnum
CREATE TYPE "CloseReason" AS ENUM ('manual', 'expiredWorthless', 'assigned');

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "contractsInitial" INTEGER,
ADD COLUMN     "contractsOpen" INTEGER;

-- 1) Add enum types / columns (Prisma usually generates these)
-- (Keep what Prisma generated above this line)

-- 2) Add the new columns (if not already generated)
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "contractsInitial" integer;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "contractsOpen" integer;

-- 3) Backfill from legacy "contracts"
UPDATE "Trade"
SET "contractsInitial" = COALESCE("contractsInitial", "contracts"),
    "contractsOpen"    = COALESCE("contractsOpen", "contracts");

-- 4) Enforce NOT NULL after backfill
ALTER TABLE "Trade" ALTER COLUMN "contractsInitial" SET NOT NULL;
ALTER TABLE "Trade" ALTER COLUMN "contractsOpen" SET NOT NULL;

-- Note: DO NOT drop the old "contracts" column yet.
