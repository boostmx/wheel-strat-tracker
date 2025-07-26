-- DropForeignKey
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_portfolioId_fkey";

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
