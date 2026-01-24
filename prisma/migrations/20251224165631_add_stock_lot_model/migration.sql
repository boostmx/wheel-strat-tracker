-- CreateEnum
CREATE TYPE "StockLotStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "stockLotId" TEXT;

-- CreateTable
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "avgCost" DECIMAL(18,6) NOT NULL,
    "status" "StockLotStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closePrice" DECIMAL(18,6),
    "realizedPnl" DECIMAL(18,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockLot_portfolioId_ticker_idx" ON "StockLot"("portfolioId", "ticker");

-- CreateIndex
CREATE INDEX "StockLot_portfolioId_status_idx" ON "StockLot"("portfolioId", "status");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "StockLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
