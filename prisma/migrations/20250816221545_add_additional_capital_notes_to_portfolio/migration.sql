/*
  Warnings:

  - You are about to drop the column `currentCapital` on the `Portfolio` table. All the data in the column will be lost.
  - You are about to alter the column `startingCapital` on the `Portfolio` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.

*/
-- DropForeignKey
ALTER TABLE "Portfolio" DROP CONSTRAINT "Portfolio_userId_fkey";

-- AlterTable
ALTER TABLE "Portfolio" DROP COLUMN "currentCapital",
ADD COLUMN     "additionalCapital" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3),
ALTER COLUMN "startingCapital" SET DEFAULT 0,
ALTER COLUMN "startingCapital" SET DATA TYPE DECIMAL(65,30);

-- CreateIndex
CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
