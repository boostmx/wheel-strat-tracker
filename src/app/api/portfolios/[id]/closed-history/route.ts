import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { prisma } from "@/server/prisma";
import { getEffectiveUserId } from "@/server/auth/getEffectiveUserId";

export const dynamic = "force-dynamic";

export type ClosedHistoryItem =
  | {
      kind: "trade";
      id: string;
      portfolioId: string;
      ticker: string;
      type: string;
      strikePrice: number;
      contractsInitial: number;
      contractsOpen: number;
      contractPrice: number;
      closingPrice: number | null;
      premiumCaptured: number | null;
      percentPL: number | null;
      createdAt: string;
      closedAt: string;
      closeReason: string | null;
      entryPrice: number | null;
      expirationDate: string;
    }
  | {
      kind: "stock";
      id: string;
      portfolioId: string;
      ticker: string;
      shares: number;
      avgCost: number;
      closePrice: number | null;
      realizedPnl: number | null;
      openedAt: string;
      closedAt: string;
    };

export type ClosedHistoryResponse = {
  items: ClosedHistoryItem[];
  total: number;
  // Aggregate metrics for the full date window (not just the current page)
  totalPremium: number;
  avgPercentPL: number | null;
};

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isAdmin = session.user.isAdmin ?? false;
  const userId = await getEffectiveUserId(session.user.id, isAdmin);
  const { id: portfolioId } = await params;

  // Verify ownership
  const portfolio = await prisma.portfolio.findFirst({
    where: isAdmin ? { id: portfolioId } : { id: portfolioId, userId },
    select: { id: true },
  });
  if (!portfolio) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const take = Math.min(Math.max(parseInt(url.searchParams.get("take") ?? "25", 10) || 25, 1), 100);
  const skip = Math.max(parseInt(url.searchParams.get("skip") ?? "0", 10) || 0, 0);
  const dateFrom = parseDateParam(url.searchParams.get("dateFrom"));
  const dateTo = parseDateParam(url.searchParams.get("dateTo"));

  const dateFilter = dateFrom || dateTo
    ? {
        gte: dateFrom ?? undefined,
        lte: dateTo ?? undefined,
      }
    : undefined;

  // Fetch all date-filtered records (both types) in parallel — counts + full data
  const [allTrades, allStockLots] = await Promise.all([
    prisma.trade.findMany({
      where: {
        portfolioId,
        status: "closed",
        ...(dateFilter ? { closedAt: dateFilter } : {}),
      },
      select: {
        id: true,
        portfolioId: true,
        ticker: true,
        type: true,
        strikePrice: true,
        contractsInitial: true,
        contractsOpen: true,
        contractPrice: true,
        closingPrice: true,
        premiumCaptured: true,
        percentPL: true,
        createdAt: true,
        closedAt: true,
        closeReason: true,
        entryPrice: true,
        expirationDate: true,
      },
      orderBy: { closedAt: "desc" },
    }),
    prisma.stockLot.findMany({
      where: {
        portfolioId,
        status: "CLOSED",
        ...(dateFilter ? { closedAt: dateFilter } : {}),
      },
      select: {
        id: true,
        portfolioId: true,
        ticker: true,
        shares: true,
        avgCost: true,
        closePrice: true,
        realizedPnl: true,
        openedAt: true,
        closedAt: true,
      },
      orderBy: { closedAt: "desc" },
    }),
  ]);

  // Compute aggregate metrics over full window (before pagination)
  let totalPremium = 0;
  let sumPctPL = 0;
  let countPctPL = 0;

  for (const t of allTrades) {
    if (t.premiumCaptured != null) totalPremium += Number(t.premiumCaptured);
    if (t.percentPL != null) { sumPctPL += Number(t.percentPL); countPctPL++; }
  }
  for (const s of allStockLots) {
    if (s.realizedPnl != null) totalPremium += Number(s.realizedPnl);
    const basis = Number(s.avgCost) * s.shares;
    if (basis > 0 && s.realizedPnl != null) {
      sumPctPL += (Number(s.realizedPnl) / basis) * 100;
      countPctPL++;
    }
  }

  // Merge and sort by closedAt desc, then paginate
  type MergedItem = { closedAt: Date; item: ClosedHistoryItem };

  const merged: MergedItem[] = [
    ...allTrades.map((t): MergedItem => ({
      closedAt: t.closedAt!,
      item: {
        kind: "trade",
        id: t.id,
        portfolioId: t.portfolioId,
        ticker: t.ticker,
        type: String(t.type),
        strikePrice: t.strikePrice,
        contractsInitial: t.contractsInitial,
        contractsOpen: t.contractsOpen,
        contractPrice: t.contractPrice,
        closingPrice: t.closingPrice ?? null,
        premiumCaptured: t.premiumCaptured ?? null,
        percentPL: t.percentPL ?? null,
        createdAt: t.createdAt.toISOString(),
        closedAt: t.closedAt!.toISOString(),
        closeReason: t.closeReason ?? null,
        entryPrice: t.entryPrice ?? null,
        expirationDate: t.expirationDate.toISOString(),
      },
    })),
    ...allStockLots.map((s): MergedItem => ({
      closedAt: s.closedAt!,
      item: {
        kind: "stock",
        id: s.id,
        portfolioId: s.portfolioId,
        ticker: s.ticker,
        shares: s.shares,
        avgCost: Number(s.avgCost),
        closePrice: s.closePrice != null ? Number(s.closePrice) : null,
        realizedPnl: s.realizedPnl != null ? Number(s.realizedPnl) : null,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt!.toISOString(),
      },
    })),
  ];

  merged.sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());

  const total = merged.length;
  const items = merged.slice(skip, skip + take).map((m) => m.item);

  const response: ClosedHistoryResponse = {
    items,
    total,
    totalPremium,
    avgPercentPL: countPctPL > 0 ? sumPctPL / countPctPL : null,
  };

  return NextResponse.json(response);
}
