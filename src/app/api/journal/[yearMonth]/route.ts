import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { prisma } from "@/server/prisma";
import { getEffectiveUserId } from "@/server/auth/getEffectiveUserId";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export type JournalTrade = {
  id: string;
  kind: "trade" | "stock";
  ticker: string;
  type: string;
  pnl: number;
  portfolioId: string;
  portfolioName: string;
};

export type JournalDay = {
  pnl: number;
  tradeCount: number;
  trades: JournalTrade[];
};

export type JournalResponse = {
  notes: string;
  days: Record<string, JournalDay>; // "YYYY-MM-DD" → day data
  monthStats: {
    totalPnl: number;
    winRate: number | null;
    tradeCount: number;
    bestDay: { date: string; pnl: number } | null;
    worstDay: { date: string; pnl: number } | null;
  };
};

function realizedFor(t: {
  type: string | null;
  contracts: number;
  contractPrice: number;
  closingPrice: number | null;
  premiumCaptured: number | null;
}): number {
  if (t.premiumCaptured != null) return Number(t.premiumCaptured);
  const open = Number(t.contractPrice);
  const close = Number(t.closingPrice ?? 0);
  const c = Number(t.contracts);
  const isShort = (t.type ?? "").toLowerCase().replace(/\s/g, "") === "cashsecuredput" ||
    (t.type ?? "").toLowerCase().includes("covered");
  return isShort ? (open - close) * 100 * c : (close - open) * 100 * c;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10); // UTC YYYY-MM-DD
}

export async function GET(
  req: Request,
  props: { params: Promise<{ yearMonth: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { yearMonth } = await props.params;
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json({ error: "Invalid yearMonth" }, { status: 400 });
  }

  const userId = await getEffectiveUserId(session.user.id, session.user.isAdmin ?? false);
  const { searchParams } = new URL(req.url);
  const portfolioIdFilter = searchParams.get("portfolioId") ?? null;

  const [year, month] = yearMonth.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1)); // exclusive

  // Portfolios scoped to user (+ optional filter)
  const portfolios = await prisma.portfolio.findMany({
    where: {
      userId,
      ...(portfolioIdFilter ? { id: portfolioIdFilter } : {}),
    },
    select: { id: true, name: true },
  });
  const portfolioIds = portfolios.map((p) => p.id);
  const portfolioNameMap = Object.fromEntries(portfolios.map((p) => [p.id, p.name]));

  if (portfolioIds.length === 0) {
    return NextResponse.json({
      notes: "",
      days: {},
      monthStats: { totalPnl: 0, winRate: null, tradeCount: 0, bestDay: null, worstDay: null },
    } satisfies JournalResponse);
  }

  // Fetch closed trades + stock lots for the month in parallel
  const [trades, stockLots, entry] = await Promise.all([
    prisma.trade.findMany({
      where: {
        portfolioId: { in: portfolioIds },
        status: "closed",
        closedAt: { gte: monthStart, lt: monthEnd },
      },
      select: {
        id: true, ticker: true, type: true, portfolioId: true,
        contracts: true, contractPrice: true, closingPrice: true, premiumCaptured: true,
        closedAt: true,
      },
    }),
    prisma.stockLot.findMany({
      where: {
        portfolioId: { in: portfolioIds },
        status: "CLOSED",
        closedAt: { gte: monthStart, lt: monthEnd },
      },
      select: {
        id: true, ticker: true, portfolioId: true,
        realizedPnl: true, closedAt: true,
      },
    }),
    prisma.journalEntry.findUnique({ where: { userId_yearMonth: { userId, yearMonth } } }),
  ]);

  // Build day map
  const days: Record<string, JournalDay> = {};

  const addToDay = (dateStr: string, trade: JournalTrade, pnl: number) => {
    if (!days[dateStr]) days[dateStr] = { pnl: 0, tradeCount: 0, trades: [] };
    days[dateStr].pnl += pnl;
    days[dateStr].tradeCount += 1;
    days[dateStr].trades.push(trade);
  };

  for (const t of trades) {
    if (!t.closedAt) continue;
    const pnl = realizedFor({
      type: t.type, contracts: Number(t.contracts),
      contractPrice: Number(t.contractPrice),
      closingPrice: t.closingPrice != null ? Number(t.closingPrice) : null,
      premiumCaptured: t.premiumCaptured != null ? Number(t.premiumCaptured) : null,
    });
    addToDay(toDateStr(t.closedAt), {
      id: t.id, kind: "trade", ticker: t.ticker ?? "",
      type: t.type ?? "", pnl,
      portfolioId: t.portfolioId,
      portfolioName: portfolioNameMap[t.portfolioId] ?? "",
    }, pnl);
  }

  for (const s of stockLots) {
    if (!s.closedAt) continue;
    const pnl = Number(s.realizedPnl ?? 0);
    addToDay(toDateStr(s.closedAt), {
      id: s.id, kind: "stock", ticker: s.ticker ?? "",
      type: "Shares", pnl,
      portfolioId: s.portfolioId,
      portfolioName: portfolioNameMap[s.portfolioId] ?? "",
    }, pnl);
  }

  // Month stats
  const allDays = Object.entries(days);
  const totalPnl = allDays.reduce((s, [, d]) => s + d.pnl, 0);
  const winDays = allDays.filter(([, d]) => d.pnl > 0).length;
  const winRate = allDays.length > 0 ? (winDays / allDays.length) * 100 : null;
  const tradeCount = allDays.reduce((s, [, d]) => s + d.tradeCount, 0);

  let bestDay: { date: string; pnl: number } | null = null;
  let worstDay: { date: string; pnl: number } | null = null;
  for (const [date, d] of allDays) {
    if (!bestDay || d.pnl > bestDay.pnl) bestDay = { date, pnl: d.pnl };
    if (!worstDay || d.pnl < worstDay.pnl) worstDay = { date, pnl: d.pnl };
  }

  return NextResponse.json({
    notes: entry?.notes ?? "",
    days,
    monthStats: { totalPnl, winRate, tradeCount, bestDay, worstDay },
  } satisfies JournalResponse);
}

export async function PUT(
  req: Request,
  props: { params: Promise<{ yearMonth: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { yearMonth } = await props.params;
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json({ error: "Invalid yearMonth" }, { status: 400 });
  }

  const userId = await getEffectiveUserId(session.user.id, session.user.isAdmin ?? false);
  const { notes } = await req.json() as { notes: string };

  const entry = await prisma.journalEntry.upsert({
    where: { userId_yearMonth: { userId, yearMonth } },
    create: { userId, yearMonth, notes: notes ?? "" },
    update: { notes: notes ?? "" },
  });

  return NextResponse.json({ notes: entry.notes });
}
