import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// --- helpers ---
const DAY_MS = 24 * 60 * 60 * 1000;

function isPut(type?: string | null) {
  if (!type) return false;
  return type.toLowerCase().includes("put");
}
function lockedCollateral(
  strikePrice?: number | null,
  contractsOpen?: number | null,
) {
  const strike = Number(strikePrice ?? 0);
  const contracts = Number(contractsOpen ?? 0);
  return Math.abs(strike) * 100 * Math.abs(contracts);
}
function premiumNotional(
  contractPrice?: number | null,
  contractsOpen?: number | null,
) {
  const premium = Number(contractPrice ?? 0);
  const contracts = Number(contractsOpen ?? 0);
  return Math.abs(premium) * 100 * Math.abs(contracts);
}

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: portfolioId } = await props.params;

    // 1) portfolio capital
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
      select: {
        startingCapital: true,
        additionalCapital: true,
      },
    });
    if (!portfolio) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const starting = Number(portfolio?.startingCapital ?? 0);
    const additional = Number(portfolio?.additionalCapital ?? 0);
    const capitalBase = starting + additional;

    // 2) open + closed trades (narrow selects)
    const [openTrades, closedTrades] = await Promise.all([
      prisma.trade.findMany({
        where: {
          status: "open",
          portfolio: { id: portfolioId, userId },
        },
        select: {
          id: true,
          type: true,
          contractsOpen: true,
          contractPrice: true, // premium per contract at entry
          strikePrice: true,
        },
      }),
      prisma.trade.findMany({
        where: {
          status: "closed",
          portfolio: { id: portfolioId, userId },
        },
        select: {
          id: true,
          type: true,
          contractsOpen: true,
          contractPrice: true, // premium at entry
          strikePrice: true,
          createdAt: true,
          closedAt: true,
          percentPL: true, // percent P/L for the trade (if you store it)
          premiumCaptured: true, // optional: if you store absolute realized P/L
        },
        orderBy: { closedAt: "desc" },
      }),
    ]);

    // 3) capital used from CSPs (collateral tied up)
    const capitalUsed = openTrades.reduce((sum, t) => {
      return (
        sum +
        (isPut(t.type) ? lockedCollateral(t.strikePrice, t.contractsOpen) : 0)
      );
    }, 0);
    // 4) open premium (potential/at-entry premium outstanding)
    const potentialPremium = openTrades.reduce((sum, t) => {
      return sum + premiumNotional(t.contractPrice, t.contractsOpen);
    }, 0);

    // 5) closed trades analytics
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const ytdStart = new Date(now.getFullYear(), 0, 1);

    let realizedTotal = 0;
    let realizedMTD = 0;
    let realizedYTD = 0;
    let sumPLPct = 0;
    let countPLPct = 0;
    let winCount = 0;
    let closeCount = 0;
    let sumDays = 0;
    let countDays = 0;

    for (const t of closedTrades) {
      const basisCollateral = isPut(t.type)
        ? lockedCollateral(t.strikePrice, t.contractsOpen)
        : 0;
      const basisPremium = premiumNotional(t.contractPrice, t.contractsOpen);

      // Prefer stored premiumCaptured (realized $); otherwise approximate via %PL.
      // - For puts, use percentPL * collateral
      // - For others, use percentPL * premium as a rough fallback
      const pct = t.percentPL ?? null;
      const realized =
        t.premiumCaptured != null
          ? Number(t.premiumCaptured)
          : pct != null
            ? (pct / 100) * (basisCollateral || basisPremium)
            : 0;

      realizedTotal += realized;

      if (t.closedAt) {
        if (t.closedAt >= thisMonthStart) realizedMTD += realized;
        if (t.closedAt >= ytdStart) realizedYTD += realized;

        closeCount += 1;
        if (pct != null && pct > 0) winCount += 1;

        if (pct != null) {
          sumPLPct += pct;
          countPLPct += 1;
        }

        if (t.createdAt) {
          const days = (t.closedAt.getTime() - t.createdAt.getTime()) / DAY_MS;
          if (Number.isFinite(days) && days >= 0) {
            sumDays += days;
            countDays += 1;
          }
        }
      }
    }

    const totalProfit = realizedTotal;
    const avgPLPercent = countPLPct > 0 ? sumPLPct / countPLPct : 0;
    const winRate = closeCount > 0 ? winCount / closeCount : 0;
    const avgDaysInTrade = countDays > 0 ? sumDays / countDays : 0;

    // 6) roll realized profit into current capital and cash
    const currentCapital = capitalBase + totalProfit; // realized profit increases capital
    const cashAvailable = currentCapital - capitalUsed; // cash available after collateral

    // percentCapitalDeployed based on currentCapital only
    const percentCapitalDeployed =
      currentCapital > 0 ? (capitalUsed / currentCapital) * 100 : 0;

    return NextResponse.json({
      // capital
      capitalBase,
      currentCapital,
      cashAvailable,
      percentCapitalDeployed,

      // realized P&L
      totalProfit,
      realizedMTD,
      realizedYTD,

      // premiums / efficiency
      potentialPremium,

      // performance stats
      avgPLPercent,
      winRate,
      avgDaysInTrade,
    });
  } catch (err) {
    console.error("detail-metrics route error", err);
    return NextResponse.json(
      { error: "Failed to load detail metrics" },
      { status: 500 },
    );
  }
}
