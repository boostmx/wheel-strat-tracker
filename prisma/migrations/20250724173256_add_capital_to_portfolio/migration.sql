/*
  Warnings:

  - Added the required column `currentCapital` to the `Portfolio` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startingCapital` to the `Portfolio` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Portfolio" ADD COLUMN     "currentCapital" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "startingCapital" DOUBLE PRECISION NOT NULL;
