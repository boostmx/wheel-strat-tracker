import {
  validateInternalApiKey,
  internalResponse,
  internalError,
} from "@/server/api/internal";
import { db } from "@/server/db";

// GET /api/internal/v1/closed-trades?userId=&from=&to=&portfolioId=
// Returns a paginated list of closed trades and closed stock lots for a user.
// Consumer: hlf-bookkeeping, hlf-wheel-alerts, future public API
export async function GET(request: Request) {
  if (!validateInternalApiKey(request)) {
    return internalError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const portfolioId = searchParams.get("portfolioId");
  const portfolioIdsParam = searchParams.get("portfolioIds");
  const portfolioIds = portfolioIdsParam?.split(",").filter(Boolean);

  if (!userId) {
    return internalError("userId is required", 400);
  }

  const closedAtFilter =
    from || to
      ? {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        }
      : undefined;

  // portfolioIds (plural) takes precedence over portfolioId (singular)
  const portfolioFilter = {
    userId,
    ...(portfolioIds?.length
      ? { id: { in: portfolioIds } }
      : portfolioId
        ? { id: portfolioId }
        : {}),
  };

  try {
    const [trades, stockLots] = await Promise.all([
      db.trade.findMany({
        where: {
          status: "closed",
          portfolio: portfolioFilter,
          closedAt: closedAtFilter,
        },
        select: {
          id: true,
          ticker: true,
          type: true,
          strikePrice: true,
          expirationDate: true,
          contracts: true,
          contractsInitial: true,
          contractPrice: true,
          closedAt: true,
          closingPrice: true,
          premiumCaptured: true,
          percentPL: true,
          closeReason: true,
          portfolioId: true,
          createdAt: true,
          portfolio: { select: { name: true } },
        },
        orderBy: { closedAt: "desc" },
      }),
      db.stockLot.findMany({
        where: {
          status: "CLOSED",
          portfolio: portfolioFilter,
          closedAt: closedAtFilter,
        },
        select: {
          id: true,
          ticker: true,
          shares: true,
          avgCost: true,
          closePrice: true,
          realizedPnl: true,
          openedAt: true,
          closedAt: true,
          portfolioId: true,
          portfolio: { select: { name: true } },
        },
        orderBy: { closedAt: "desc" },
      }),
    ]);

    return internalResponse(
      {
        trades: trades.map(({ portfolio, ...t }) => ({
          ...t,
          portfolioName: portfolio.name,
        })),
        stockLots: stockLots.map(({ portfolio, ...s }) => ({
          ...s,
          avgCost: Number(s.avgCost),
          closePrice: s.closePrice !== null ? Number(s.closePrice) : null,
          realizedPnl: s.realizedPnl !== null ? Number(s.realizedPnl) : null,
          portfolioName: portfolio.name,
        })),
      },
      { total: trades.length + stockLots.length },
    );
  } catch (error) {
    console.error("[internal/closed-trades] error:", error);
    return internalError("Internal server error", 500);
  }
}
