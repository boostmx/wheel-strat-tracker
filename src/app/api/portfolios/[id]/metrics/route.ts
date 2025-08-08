import { prisma } from "@/lib/prisma";
import { Trade } from "@prisma/client";
import { NextResponse } from "next/server";

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
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const closedTrades = await prisma.trade.findMany({
    where: { portfolioId, status: "closed" },
  });

  const openTrades = await prisma.trade.findMany({
    where: { portfolioId, status: "open" },
  });

  const capitalUsed = openTrades.reduce((sum: number, trade: Trade) => {
    return sum + trade.contracts * trade.strikePrice * 100;
  }, 0);

  // Calculate % of capital deployed
  const percentCapitalDeployed =
    portfolio.startingCapital > 0
      ? (capitalUsed / portfolio.startingCapital) * 100
      : 0;

  // average days in trade
  const avgDaysInTrade =
    closedTrades.reduce((sum, trade) => {
      if (!trade.closedAt) return sum;
      const opened = trade.createdAt.getTime();
      const closed = trade.closedAt.getTime();
      const days = (closed - opened) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0) / closedTrades.length;

  if (!closedTrades.length) {
    return NextResponse.json({
      startingCapital: portfolio.startingCapital,
      capitalUsed,
      percentCapitalDeployed,
      avgDaysInTrade,
      winRate: 0,
      totalProfit: 0,
      avgPLPercent: 0,
    });
  }

  // total profit in $
  const totalProfit = closedTrades.reduce((sum, trade) => {
    return sum + (trade.premiumCaptured ?? 0);
  }, 0);

  // win rate
  const winCount = closedTrades.filter(
    (t) => (t.premiumCaptured ?? 0) > 0,
  ).length;
  const winRate = winCount / closedTrades.length;

  // average P/L % per trade
  const avgPLPercent =
    closedTrades.reduce((sum, trade) => {
      const usedCapital = trade.contracts * trade.strikePrice * 100;
      const plPercent = usedCapital
        ? ((trade.premiumCaptured ?? 0) / usedCapital) * 100
        : 0;
      return sum + plPercent;
    }, 0) / closedTrades.length;

  return NextResponse.json({
    startingCapital: portfolio.startingCapital,
    capitalUsed,
    winRate,
    totalProfit,
    avgPLPercent,
  });
}
