import { prisma } from "@/server/db";
import { Trade } from "@/types";

export async function getClosedTradesInRange(params: {
  portfolioId: string;
  start: Date;
  end: Date;
  userId: string;
}): Promise<Trade[]> {
  const { portfolioId, start, end, userId } = params;

  // Ensure user owns this portfolio; replace with your existing check
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    select: { id: true },
  });
  if (!portfolio) return [];

  const trades = await prisma.trade.findMany({
    where: {
      portfolioId,
      status: "closed",
      closedAt: {
        gte: start,
        lt: end,
      },
    },
    orderBy: { closedAt: "desc" },
    select: {
      id: true,
      portfolioId: true,
      ticker: true,
      strikePrice: true,
      entryPrice: true,
      expirationDate: true,
      type: true,
      contracts: true,
      contractsInitial: true,
      contractsOpen: true,
      contractPrice: true,
      closingPrice: true,
      closedAt: true,
      premiumCaptured: true,
      percentPL: true,
      notes: true,
      status: true,
      createdAt: true,
    },
  });

  return trades.map((t) => ({
    id: t.id,
    portfolioId: t.portfolioId,
    ticker: t.ticker,
    strikePrice: t.strikePrice,
    entryPrice: t.entryPrice ?? undefined,
    expirationDate: t.expirationDate.toISOString(),
    type: String(t.type),
    contracts: t.contracts,
    contractsInitial: t.contractsInitial ?? t.contracts,
    contractsOpen: t.contractsOpen ?? 0,
    contractPrice: t.contractPrice,
    closingPrice: t.closingPrice ?? undefined,
    closedAt: t.closedAt ? t.closedAt.toISOString() : null,
    premiumCaptured: t.premiumCaptured,
    percentPL: t.percentPL,
    notes: t.notes,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    totalContracts: t.contractsInitial ?? t.contracts,
  }));
}
