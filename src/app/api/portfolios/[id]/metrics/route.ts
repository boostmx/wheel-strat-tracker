import { prisma } from "@/server/prisma";
import { NextResponse } from "next/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// Cash‑secured puts are what lock collateral
function isPut(type: string | null | undefined) {
  if (!type) return false;
  return type.toLowerCase().includes("put");
}

function lockedCollateral(strikePrice: number, contracts: number) {
  // 100 shares per contract
  return Math.abs(strikePrice) * 100 * Math.abs(contracts);
}

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id: portfolioId } = await props.params;

    // Optional: limit how many upcoming expirations are returned (default 3, max 10)
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const MAX_NEXT = 10;
    const limit = Math.min(
      Math.max(Number.parseInt(limitParam || "3", 10) || 3, 1),
      MAX_NEXT,
    );

    // Only OPEN trades and only fields we need (fast)
    const openTrades = await prisma.trade.findMany({
      where: { portfolioId, status: "open" },
      select: {
        id: true,
        ticker: true,
        type: true,
        contracts: true,
        strikePrice: true,
        expirationDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const openTradesCount = openTrades.length;

    // Capital used = total CSP collateral locked
    const capitalUsed = openTrades.reduce((sum, t) => {
      return sum + (isPut(t.type) ? lockedCollateral(t.strikePrice, t.contracts) : 0);
    }, 0);

    // Biggest position by CSP collateral
    const biggestPosition =
      openTrades
        .filter((t) => isPut(t.type))
        .map((t) => ({
          id: t.id,
          ticker: t.ticker,
          strikePrice: t.strikePrice,
          contracts: t.contracts,
          expirationDate: t.expirationDate,
          locked: lockedCollateral(t.strikePrice, t.contracts),
        }))
        .sort((a, b) => b.locked - a.locked)[0] ?? null;

    // Soonest upcoming expirations (<= limit)
    const now = Date.now();
    const nextExpirations = openTrades
      .filter((t) => t.expirationDate && t.expirationDate.getTime() > now)
      .sort((a, b) => a.expirationDate!.getTime() - b.expirationDate!.getTime())
      .slice(0, limit)
      .map((t) => ({
        ticker: t.ticker,
        expirationDate: t.expirationDate!, // Date (serialized to ISO)
        contracts: t.contracts,
        strikePrice: t.strikePrice,
        type: t.type,
      }));

    return NextResponse.json({
      openTradesCount,
      capitalUsed,
      biggestPosition,  // null or { id, ticker, strikePrice, contracts, locked, expirationDate }
      nextExpirations,  // array (<= limit)
    });
  } catch (err) {
    console.error("GET /api/portfolios/[id]/metrics error", err);
    return NextResponse.json(
      { error: "Failed to load overview metrics" },
      { status: 500 },
    );
  }
}