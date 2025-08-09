import { prisma } from "@/lib/prisma";
import { Trade } from "@prisma/client";
import { NextResponse } from "next/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// Reusable "no-store" JSON responder
function jsonNoStore(data: unknown, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const portfolioId = id;

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: { startingCapital: true },
  });

  if (!portfolio) {
    return jsonNoStore({ error: "Portfolio not found" }, 404);
  }

  const [closedTrades, openTrades] = await Promise.all([
    prisma.trade.findMany({ where: { portfolioId, status: "closed" } }),
    prisma.trade.findMany({ where: { portfolioId, status: "open" } }),
  ]);

  // Capital used (only CSP ties up cash; CC uses covered shares)
  const capitalUsed = openTrades.reduce((sum: number, t: Trade) => {
    const typeStr = String(t.type ?? "").toLowerCase();
    const isCSP =
      (typeStr.includes("cash") && typeStr.includes("put")) || typeStr === "put";
    return isCSP ? sum + t.contracts * t.strikePrice * 100 : sum;
  }, 0);

  const percentCapitalDeployed =
    portfolio.startingCapital > 0
      ? (capitalUsed / portfolio.startingCapital) * 100
      : 0;

  // Average days in trade (closed only)
  const avgDaysInTrade =
    closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => {
          if (!t.closedAt) return sum;
          const opened = t.createdAt.getTime();
          const closed = t.closedAt.getTime();
          return sum + (closed - opened) / (1000 * 60 * 60 * 24);
        }, 0) / closedTrades.length
      : 0;

  if (closedTrades.length === 0) {
    return jsonNoStore({
      startingCapital: portfolio.startingCapital,
      capitalUsed,
      percentCapitalDeployed,
      avgDaysInTrade,
      winRate: 0,
      totalProfit: 0,
      avgPLPercent: 0,
    });
  }

  // TOTAL realized P&L: just sum premiumCaptured
  const totalProfit = closedTrades.reduce(
    (sum, t) => sum + (t.premiumCaptured ?? 0),
    0,
  );

  // WIN RATE: premiumCaptured > 0 counts as a win
  const wins = closedTrades.filter((t) => (t.premiumCaptured ?? 0) > 0).length;
  const winRate = wins / closedTrades.length;

  // AVG % P/L: use stored percentPL (typically set on full close)
  const percents = closedTrades
    .map((t) => t.percentPL)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const avgPLPercent =
    percents.length > 0
      ? percents.reduce((a, b) => a + b, 0) / percents.length
      : 0;

  return jsonNoStore({
    startingCapital: portfolio.startingCapital,
    capitalUsed,
    percentCapitalDeployed,
    avgDaysInTrade,
    winRate,
    totalProfit,
    avgPLPercent,
  });
}