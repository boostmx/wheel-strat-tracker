import {
  validateInternalApiKey,
  internalResponse,
  internalError,
} from "@/server/api/internal";
import { db } from "@/server/db";

// GET /api/internal/v1/trading-summary?userId=&from=&to=&portfolioIds=
// Returns aggregated closed P&L for a user, optionally filtered by date range
// and portfolio IDs (comma-separated).
// Consumer: hlf-bookkeeping (replaces its direct cross-DB query)
export async function GET(request: Request) {
  if (!validateInternalApiKey(request)) {
    return internalError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const portfolioIdsParam = searchParams.get("portfolioIds");

  if (!userId) {
    return internalError("userId is required", 400);
  }

  const portfolioIds = portfolioIdsParam
    ? portfolioIdsParam.split(",").filter(Boolean)
    : undefined;

  const closedAtFilter =
    from || to
      ? {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        }
      : undefined;

  const portfolioFilter = {
    userId,
    ...(portfolioIds && { id: { in: portfolioIds } }),
  };

  try {
    const [trades, stockLots, portfolios] = await Promise.all([
      db.trade.findMany({
        where: {
          status: "closed",
          portfolio: portfolioFilter,
          closedAt: closedAtFilter,
        },
        select: {
          portfolioId: true,
          premiumCaptured: true,
        },
      }),
      db.stockLot.findMany({
        where: {
          status: "CLOSED",
          portfolio: portfolioFilter,
          closedAt: closedAtFilter,
        },
        select: {
          portfolioId: true,
          realizedPnl: true,
        },
      }),
      db.portfolio.findMany({
        where: portfolioFilter,
        select: { id: true, name: true },
      }),
    ]);

    const portfolioMap = new Map(portfolios.map((p) => [p.id, p.name]));

    type PortfolioAgg = {
      portfolioId: string;
      portfolioName: string;
      tradePnl: number;
      stockPnl: number;
      totalPnl: number;
      tradeCount: number;
      winCount: number;
    };

    const byPortfolio = new Map<string, PortfolioAgg>();

    for (const trade of trades) {
      const existing = byPortfolio.get(trade.portfolioId);
      const agg: PortfolioAgg = existing ?? {
        portfolioId: trade.portfolioId,
        portfolioName: portfolioMap.get(trade.portfolioId) ?? "Unknown",
        tradePnl: 0,
        stockPnl: 0,
        totalPnl: 0,
        tradeCount: 0,
        winCount: 0,
      };
      const pnl = trade.premiumCaptured ?? 0;
      agg.tradePnl += pnl;
      agg.tradeCount += 1;
      if (pnl > 0) agg.winCount += 1;
      byPortfolio.set(trade.portfolioId, agg);
    }

    for (const lot of stockLots) {
      const existing = byPortfolio.get(lot.portfolioId);
      const agg: PortfolioAgg = existing ?? {
        portfolioId: lot.portfolioId,
        portfolioName: portfolioMap.get(lot.portfolioId) ?? "Unknown",
        tradePnl: 0,
        stockPnl: 0,
        totalPnl: 0,
        tradeCount: 0,
        winCount: 0,
      };
      agg.stockPnl += Number(lot.realizedPnl ?? 0);
      byPortfolio.set(lot.portfolioId, agg);
    }

    const aggregates = Array.from(byPortfolio.values()).map((agg) => ({
      ...agg,
      totalPnl: agg.tradePnl + agg.stockPnl,
    }));

    const totals = aggregates.reduce(
      (acc, p) => ({
        tradePnl: acc.tradePnl + p.tradePnl,
        stockPnl: acc.stockPnl + p.stockPnl,
        totalPnl: acc.totalPnl + p.totalPnl,
        tradeCount: acc.tradeCount + p.tradeCount,
        winCount: acc.winCount + p.winCount,
      }),
      { tradePnl: 0, stockPnl: 0, totalPnl: 0, tradeCount: 0, winCount: 0 },
    );

    return internalResponse({
      ...totals,
      winRate:
        totals.tradeCount > 0 ? totals.winCount / totals.tradeCount : 0,
      byPortfolio: aggregates,
    });
  } catch (error) {
    console.error("[internal/trading-summary] error:", error);
    return internalError("Internal server error", 500);
  }
}
