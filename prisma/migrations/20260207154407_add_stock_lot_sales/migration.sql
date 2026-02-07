-- CreateEnum
CREATE TYPE "StockLotSaleSource" AS ENUM ('manual', 'assignment');

-- CreateTable
CREATE TABLE "StockLotSale" (
    "id" TEXT NOT NULL,
    "stockLotId" TEXT NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sharesSold" INTEGER NOT NULL,
    "salePrice" DECIMAL(18,6) NOT NULL,
    "fees" DECIMAL(18,2),
    "realizedPnl" DECIMAL(18,2) NOT NULL,
    "source" "StockLotSaleSource" NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLotSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockLotSale_stockLotId_soldAt_idx" ON "StockLotSale"("stockLotId", "soldAt");

-- AddForeignKey
ALTER TABLE "StockLotSale" ADD CONSTRAINT "StockLotSale_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "StockLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
