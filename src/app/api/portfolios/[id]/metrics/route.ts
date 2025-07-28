import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const portfolioId = id;

  const closedTrades = await prisma.trade.findMany({
    where: {
      portfolioId,
      status: "closed",
    },
  });

  if (!closedTrades.length) {
    return NextResponse.json({
      totalReturn: 0,
      annualizedReturn: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      winRate: 0,
    });
  }

  const totalPremium = closedTrades.reduce((sum, trade) => {
    return sum + (trade.premiumCaptured ?? 0);
  }, 0);

  const totalUsedCapital = closedTrades.reduce((sum, trade) => {
    return sum + trade.contracts * trade.strikePrice * 100;
  }, 0);

  const totalReturn = totalPremium / totalUsedCapital || 0;

  const now = new Date();
  const earliest = closedTrades.reduce((min, trade) => {
    return trade.closedAt && trade.closedAt < min ? trade.closedAt : min;
  }, closedTrades[0].closedAt ?? now);

  const daysHeld =
    (now.getTime() - (earliest?.getTime() ?? now.getTime())) /
    (1000 * 60 * 60 * 24);

  const annualizedReturn =
    daysHeld > 0 ? Math.pow(1 + totalReturn, 365 / daysHeld) - 1 : 0;

  const winCount = closedTrades.filter(
    (t) => (t.premiumCaptured ?? 0) > 0,
  ).length;
  const winRate = winCount / closedTrades.length;

  // Basic Sharpe approximation
  const sharpeRatio = totalReturn / 0.15; // Assuming 15% std deviation

  // Max drawdown stub (replace with equity curve logic if needed)
  const maxDrawdown = 0;

  return NextResponse.json({
    totalReturn,
    annualizedReturn,
    maxDrawdown,
    sharpeRatio,
    winRate,
  });
}
