import {
  validateInternalApiKey,
  internalResponse,
  internalError,
} from "@/server/api/internal";
import { db } from "@/server/db";

// GET /api/internal/v1/open-positions?userId=  (HLF suite apps — shared DB)
// GET /api/internal/v1/open-positions?email=   (hlf-wheel-alerts — separate DB, lookup by email)
// Returns open trades and stock lots for a given user.
export async function GET(request: Request) {
  if (!validateInternalApiKey(request)) {
    return internalError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const email = searchParams.get("email");

  if (!userId && !email) {
    return internalError("userId or email is required", 400);
  }

  let resolvedUserId = userId;
  if (!resolvedUserId && email) {
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return internalResponse({ trades: [], stockLots: [] });
    resolvedUserId = user.id;
  }

  try {
    const [trades, stockLots] = await Promise.all([
      db.trade.findMany({
        where: {
          status: "open",
          portfolio: { userId: resolvedUserId! },
        },
        select: {
          id: true,
          ticker: true,
          type: true,
          strikePrice: true,
          expirationDate: true,
          contracts: true,
          contractsOpen: true,
          contractsInitial: true,
          contractPrice: true,
          entryPrice: true,
          portfolioId: true,
          stockLotId: true,
          createdAt: true,
          portfolio: { select: { name: true } },
        },
        orderBy: { expirationDate: "asc" },
      }),
      db.stockLot.findMany({
        where: {
          status: "OPEN",
          portfolio: { userId: resolvedUserId! },
        },
        select: {
          id: true,
          ticker: true,
          shares: true,
          avgCost: true,
          portfolioId: true,
          openedAt: true,
          portfolio: { select: { name: true } },
        },
        orderBy: { openedAt: "asc" },
      }),
    ]);

    return internalResponse({
      trades: trades.map(({ portfolio, ...t }) => ({
        ...t,
        portfolioName: portfolio.name,
      })),
      stockLots: stockLots.map(({ portfolio, ...s }) => ({
        ...s,
        avgCost: Number(s.avgCost),
        portfolioName: portfolio.name,
      })),
    });
  } catch (error) {
    console.error("[internal/open-positions] error:", error);
    return internalError("Internal server error", 500);
  }
}
