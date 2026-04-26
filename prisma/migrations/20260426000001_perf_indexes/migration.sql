-- Index for date-ranged closed trade queries (portfolioId + status + closedAt)
-- Covers: /api/portfolios/[id]/closed-history, /api/reports/closed, /api/portfolios/[id]/metrics
CREATE INDEX "Trade_portfolioId_status_closedAt_idx" ON "Trade"("portfolioId", "status", "closedAt");

-- Index for date-ranged closed stock lot queries (portfolioId + closedAt)
-- Covers: /api/portfolios/[id]/closed-history, /api/reports/closed
CREATE INDEX "StockLot_portfolioId_closedAt_idx" ON "StockLot"("portfolioId", "closedAt");
