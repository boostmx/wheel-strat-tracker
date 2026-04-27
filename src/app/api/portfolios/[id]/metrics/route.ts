import { prisma } from "@/server/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { capitalUsedForTrade } from "@/lib/tradeMetrics";
import { getEffectiveUserId } from "@/server/auth/getEffectiveUserId";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function isCSP(type?: string | null) {
  const t = (type ?? "").toLowerCase();
  return t === "cash secured put" || t === "cashsecuredput" || t === "csp";
}

function isCC(type?: string | null) {
  const t = (type ?? "").toLowerCase();
  return t === "covered call" || t === "coveredcall" || t === "cc";
}

function lockedCollateral(strikePrice?: number | null, contractsOpen?: number | null) {
  return Math.abs(Number(strikePrice ?? 0)) * 100 * Math.abs(Number(contractsOpen ?? 0));
}

function premiumNotional(contractPrice?: number | null, contractsOpen?: number | null) {
  return Math.abs(Number(contractPrice ?? 0)) * 100 * Math.abs(Number(contractsOpen ?? 0));
}

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = await getEffectiveUserId(session.user.id, session.user.isAdmin ?? false);
    const isAdmin = session.user.isAdmin ?? false;

    const { id: portfolioId } = await props.params;

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(Number.parseInt(limitParam || "3", 10) || 3, 1), 10);

    const portfolioWhere = isAdmin ? { id: portfolioId } : { id: portfolioId, userId };
    const portfolio = await prisma.portfolio.findFirst({
      where: portfolioWhere,
      select: {
        startingCapital: true,
        capitalTransactions: { select: { type: true, amount: true } },
      },
    });
    if (!portfolio) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const netCapitalAdj = portfolio.capitalTransactions.reduce(
      (sum, t) => sum + (t.type === "deposit" ? Number(t.amount) : -Number(t.amount)),
      0,
    );
    const capitalBase = Number(portfolio.startingCapital ?? 0) + netCapitalAdj;

    // Closed trade analytics — date boundaries (UTC-safe) moved above
    const now = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const tradePortfolioWhere = isAdmin ? { id: portfolioId } : { id: portfolioId, userId };

    // All queries in one parallel round trip.
    // closedAll: needed for all-time totals, win rate, avg hold — no sort needed.
    // closedMTD / closedYTD: date-filtered so only the relevant subset is transferred.
    const [openTrades, closedAll, closedMTD, closedYTD, openStockLots] = await Promise.all([
      prisma.trade.findMany({
        where: { status: "open", portfolio: tradePortfolioWhere },
        select: {
          id: true,
          ticker: true,
          type: true,
          contractsOpen: true,
          strikePrice: true,
          expirationDate: true,
          createdAt: true,
          contractPrice: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.trade.findMany({
        where: { status: "closed", portfolio: tradePortfolioWhere },
        select: {
          type: true,
          contractsOpen: true,
          contractPrice: true,
          strikePrice: true,
          createdAt: true,
          closedAt: true,
          percentPL: true,
          premiumCaptured: true,
        },
      }),
      prisma.trade.findMany({
        where: { status: "closed", closedAt: { gte: thisMonthStart }, portfolio: tradePortfolioWhere },
        select: { type: true, contractsOpen: true, contractPrice: true, strikePrice: true, percentPL: true, premiumCaptured: true },
      }),
      prisma.trade.findMany({
        where: { status: "closed", closedAt: { gte: ytdStart }, portfolio: tradePortfolioWhere },
        select: { type: true, contractsOpen: true, contractPrice: true, strikePrice: true, percentPL: true, premiumCaptured: true },
      }),
      prisma.stockLot.findMany({
        where: { status: "OPEN", portfolio: tradePortfolioWhere },
        select: { shares: true, avgCost: true },
      }),
    ]);

    // Capital calculations (computed once, shared by both views)
    const capitalUsedOptions = openTrades.reduce(
      (sum, t) =>
        sum +
        capitalUsedForTrade({
          type: t.type,
          strikePrice: t.strikePrice,
          contractsOpen: t.contractsOpen,
          contractPrice: t.contractPrice,
        }),
      0,
    );

    const capitalUsedStocks = openStockLots.reduce(
      (sum, lot) => sum + Number(lot.shares ?? 0) * Number(lot.avgCost ?? 0),
      0,
    );

    const capitalUsed = capitalUsedOptions + capitalUsedStocks;

    // Open trade metrics
    const openTradesCount = openTrades.length;

    const potentialPremium = openTrades.reduce(
      (sum, t) =>
        sum + (isCSP(t.type) || isCC(t.type) ? premiumNotional(t.contractPrice, t.contractsOpen) : 0),
      0,
    );

    const biggestPosition =
      openTrades
        .filter((t) => isCSP(t.type))
        .map((t) => ({
          id: t.id,
          ticker: t.ticker,
          strikePrice: t.strikePrice,
          contracts: Number(t.contractsOpen ?? 0),
          expirationDate: t.expirationDate,
          locked: lockedCollateral(t.strikePrice, t.contractsOpen),
        }))
        .sort((a, b) => b.locked - a.locked)[0] ?? null;

    const nowMs = Date.now();
    const sevenDaysMs = nowMs + 7 * DAY_MS;
    const thirtyDaysMs = nowMs + 30 * DAY_MS;

    const expiringInSevenDays = openTrades.filter(
      (t) => t.expirationDate && t.expirationDate.getTime() > nowMs && t.expirationDate.getTime() <= sevenDaysMs,
    ).length;

    const expiringInThirtyDays = openTrades.filter(
      (t) => t.expirationDate && t.expirationDate.getTime() > nowMs && t.expirationDate.getTime() <= thirtyDaysMs,
    ).length;

    const nextExpirations = openTrades
      .filter((t) => t.expirationDate && t.expirationDate.getTime() > nowMs)
      .sort((a, b) => a.expirationDate!.getTime() - b.expirationDate!.getTime())
      .slice(0, limit)
      .map((t) => ({
        ticker: t.ticker,
        expirationDate: t.expirationDate!,
        contracts: Number(t.contractsOpen ?? 0),
        strikePrice: t.strikePrice,
        type: t.type,
      }));


    // Helper: compute realized amount for a single closed trade row
    const realizedFor = (t: { type: string | null; contractsOpen: number | null; contractPrice: number; strikePrice: number | null; percentPL: number | null; premiumCaptured: number | null }) => {
      if (t.premiumCaptured != null) return Number(t.premiumCaptured);
      const pct = t.percentPL ?? null;
      if (pct != null) {
        const basisCollateral = isCSP(t.type) ? lockedCollateral(t.strikePrice, t.contractsOpen) : 0;
        const basisPremium = premiumNotional(t.contractPrice, t.contractsOpen);
        return (pct / 100) * (basisCollateral || basisPremium);
      }
      return 0;
    };

    // Period sums from date-filtered queries — avoids iterating full history for MTD/YTD
    const realizedMTD = closedMTD.reduce((s, t) => s + realizedFor(t), 0);
    const realizedYTD = closedYTD.reduce((s, t) => s + realizedFor(t), 0);

    // All-time stats require iterating the full history
    let realizedTotal = 0;
    let sumPLPct = 0;
    let countPLPct = 0;
    let winCount = 0;
    let closeCount = 0;
    let sumDays = 0;
    let countDays = 0;

    for (const t of closedAll) {
      const pct = t.percentPL ?? null;
      const realized = realizedFor(t);
      realizedTotal += realized;

      if (t.closedAt) {
        closeCount += 1;
        if (pct != null && pct > 0) winCount += 1;
        if (pct != null) { sumPLPct += pct; countPLPct += 1; }
        if (t.createdAt) {
          const days = (t.closedAt.getTime() - t.createdAt.getTime()) / DAY_MS;
          if (Number.isFinite(days) && days >= 0) { sumDays += days; countDays += 1; }
        }
      }
    }

    const totalProfit = realizedTotal;
    const avgPLPercent = countPLPct > 0 ? sumPLPct / countPLPct : 0;
    const winRate = closeCount > 0 ? winCount / closeCount : 0;
    const avgDaysInTrade = countDays > 0 ? sumDays / countDays : 0;
    const currentCapital = capitalBase + totalProfit;
    const cashAvailable = currentCapital - capitalUsed;
    const percentCapitalDeployed = currentCapital > 0 ? (capitalUsed / currentCapital) * 100 : 0;

    return NextResponse.json({
      // capital
      capitalBase,
      currentCapital,
      cashAvailable,
      percentCapitalDeployed,
      capitalUsed,
      capitalUsedOptions,
      capitalUsedStocks,

      // realized P&L
      totalProfit,
      realizedMTD,
      realizedYTD,

      // efficiency
      potentialPremium,

      // performance stats
      avgPLPercent,
      winRate,
      avgDaysInTrade,

      // overview / expiration fields
      openTradesCount,
      biggestPosition,
      nextExpirations,
      expiringInSevenDays,
      expiringInThirtyDays,
    });
  } catch (err) {
    console.error("GET /api/portfolios/[id]/metrics error", err);
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}
