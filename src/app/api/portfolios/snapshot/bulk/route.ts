import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type Snapshot = {
  portfolioId: string;
  startingCapital: number;
  additionalCapital: number; // NEW
  capitalBase: number;       // NEW: starting + additional
  currentCapital: number;    // capitalBase + totalProfitAll (realized)
  totalProfitAll: number;    // realized P/L all time
  openCount: number;
  capitalInUse: number;      // CSP collateral
  cashAvailable: number;     // currentCapital - capitalInUse
  biggest: {
    ticker: string;
    strikePrice: number;
    contracts: number;
    collateral: number;
    expirationDate: string;
  } | null;
  topTickers: { ticker: string; collateral: number; pct: number }[];
  nextExpiration: { date: string; contracts: number } | null;
  expiringSoonCount: number; // contracts expiring in next 7d
  openAvgDays: number | null;
  realizedMTD: number;
  realizedYTD: number;
};

const COLL = (strike: number, contracts: number) =>
  Number(strike) * 100 * Number(contracts);

function startOfMonthUTC() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function startOfYearUTC() {
  const d = new Date();
  d.setUTCMonth(0, 1);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function daysBetween(a: Date | string, b: Date) {
  const da = new Date(a).getTime();
  const db = b.getTime();
  return Math.max(0, (db - da) / (1000 * 60 * 60 * 24));
}

// Prefer premiumCaptured; else (open credit − close debit) × 100 × contracts.
// Treat closingPrice null as 0.
const tradePL = (t: {
  contracts: number;
  contractPrice: number;
  closingPrice: number | null;
  premiumCaptured: number | null;
}) => {
  if (t.premiumCaptured != null) return Number(t.premiumCaptured);
  const close = t.closingPrice ?? 0;
  return (Number(t.contractPrice) - Number(close)) * 100 * Number(t.contracts);
};

const sumPL = (
  rows: Array<{
    contracts: number;
    contractPrice: number;
    closingPrice: number | null;
    premiumCaptured: number | null;
  }>,
) => rows.reduce((s, t) => s + tradePL(t), 0);

export async function POST(req: Request) {
  const { ids } = (await req.json()) as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({});
  }

  const outEntries = await Promise.all(
    ids.map(async (portfolioId) => {
      const [portfolio, openTrades, closedAll, closedMTD, closedYTD] =
        await Promise.all([
          prisma.portfolio.findUnique({
            where: { id: portfolioId },
            select: { startingCapital: true, additionalCapital: true },
          }),
          prisma.trade.findMany({
            where: { portfolioId, status: "open" },
            select: {
              ticker: true,
              type: true,
              strikePrice: true,
              contracts: true,
              expirationDate: true,
              createdAt: true,
            },
          }),
          prisma.trade.findMany({
            where: { portfolioId, status: "closed" },
            select: {
              contracts: true,
              contractPrice: true,
              closingPrice: true,
              premiumCaptured: true,
            },
          }),
          prisma.trade.findMany({
            where: {
              portfolioId,
              status: "closed",
              closedAt: { gte: startOfMonthUTC() },
            },
            select: {
              contracts: true,
              contractPrice: true,
              closingPrice: true,
              premiumCaptured: true,
            },
          }),
          prisma.trade.findMany({
            where: {
              portfolioId,
              status: "closed",
              closedAt: { gte: startOfYearUTC() },
            },
            select: {
              contracts: true,
              contractPrice: true,
              closingPrice: true,
              premiumCaptured: true,
            },
          }),
        ]);

      if (!portfolio) return [portfolioId, null] as const;

      // Open counts + collateral (CSP only)
      const cspOpen = openTrades.filter((t) => t.type === "CashSecuredPut"); // adjust label if needed
      const capitalInUse = cspOpen.reduce(
        (s, t) => s + COLL(t.strikePrice, t.contracts),
        0,
      );

      // Biggest position by collateral
      const biggestRaw = cspOpen
        .map((t) => ({ ...t, collateral: COLL(t.strikePrice, t.contracts) }))
        .sort((a, b) => b.collateral - a.collateral)[0];
      const biggest = biggestRaw
        ? {
            ticker: biggestRaw.ticker,
            strikePrice: Number(biggestRaw.strikePrice),
            contracts: Number(biggestRaw.contracts),
            collateral: Number(biggestRaw.collateral),
            expirationDate: new Date(biggestRaw.expirationDate).toISOString(),
          }
        : null;

      // Top tickers by exposure (collateral share)
      const byTicker = new Map<string, number>();
      for (const t of cspOpen) {
        byTicker.set(
          t.ticker,
          (byTicker.get(t.ticker) ?? 0) + COLL(t.strikePrice, t.contracts),
        );
      }
      const totalColl =
        Array.from(byTicker.values()).reduce((a, b) => a + b, 0) || 1;
      const topTickers = Array.from(byTicker.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([ticker, coll]) => ({
          ticker,
          collateral: coll,
          pct: (coll / totalColl) * 100,
        }));

      // Next expiration + expiring soon
      const now = new Date();
      const soon = new Date(now);
      soon.setDate(now.getDate() + 7);
      const expiringSoon = openTrades.filter(
        (t) => new Date(t.expirationDate) <= soon,
      );
      const expiringByDate = new Map<string, number>();
      for (const t of openTrades) {
        const d = new Date(t.expirationDate).toISOString().slice(0, 10);
        expiringByDate.set(
          d,
          (expiringByDate.get(d) ?? 0) + Number(t.contracts),
        );
      }
      const next = Array.from(expiringByDate.entries()).sort((a, b) =>
        a[0].localeCompare(b[0]),
      )[0];
      const nextExpiration = next
        ? { date: next[0], contracts: next[1] }
        : null;

      // Open avg age (days)
      const openAvgDays =
        openTrades.length === 0
          ? null
          : Number(
              (
                openTrades.reduce(
                  (s, t) => s + daysBetween(t.createdAt, now),
                  0,
                ) / openTrades.length
              ).toFixed(1),
            );

      // Realized P/L
      const totalProfitAll = sumPL(closedAll);
      const realizedMTD = sumPL(closedMTD);
      const realizedYTD = sumPL(closedYTD);

      // Current & available capital
      const starting = Number(portfolio.startingCapital);
      const additional = Number(portfolio.additionalCapital ?? 0);
      const capitalBase = starting + additional; // baseline pool committed to strategy
      const currentCapital = capitalBase + totalProfitAll; // realized P&L increases/decreases cash
      const cashAvailable = currentCapital - capitalInUse; // free after collateral usage

      const snap: Snapshot = {
        portfolioId,
        startingCapital: starting,
        additionalCapital: additional,
        capitalBase,
        currentCapital,
        totalProfitAll,
        openCount: openTrades.length,
        capitalInUse,
        cashAvailable,
        biggest,
        topTickers,
        nextExpiration,
        expiringSoonCount: expiringSoon.reduce(
          (s, t) => s + Number(t.contracts),
          0,
        ),
        openAvgDays,
        realizedMTD,
        realizedYTD,
      };

      return [portfolioId, snap] as const;
    }),
  );

  return NextResponse.json(Object.fromEntries(outEntries));
}
