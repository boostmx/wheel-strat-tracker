import { prisma } from "@/server/prisma";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";

type CloseTradePayload = {
  closingContracts?: number;
  contractsToClose?: number;
  contracts?: number;
  closingContractPrice?: number;
  closingPrice?: number;
  price?: number;
  feesPerContract?: number;
  flatFees?: number;
  fullClose?: boolean;
};

//helpers to interpret trade types
const isShortOption = (type: string): boolean =>
  type === "Cash Secured Put" || type === "Covered Call";

const isLongOption = (type: string): boolean =>
  type === "Put" || type === "Call";

const CONTRACT_MULTIPLIER = 100;

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const params = await props.params;
  const id = await params.id;

  const body: CloseTradePayload = await req
    .json()
    .catch(() => ({}) as CloseTradePayload);

  // Support both new and legacy payload shapes
  const contractsToCloseRaw = Number(
    body.closingContracts ?? body.contractsToClose ?? body.contracts,
  );
  const contractsToClose = Math.trunc(contractsToCloseRaw);
  const closingPrice = Number(
    body.closingContractPrice ?? body.closingPrice ?? body.price,
  );
  const feesPerContract = Number(body.feesPerContract ?? 0);
  const flatFees = Number(body.flatFees ?? 0);

  if (!Number.isFinite(contractsToClose) || contractsToClose <= 0) {
    return new Response("Invalid contractsToClose", { status: 400 });
  }
  // allow 0 for expiry / buyback at 0.00
  if (!Number.isFinite(closingPrice) || closingPrice < 0) {
    return new Response("Invalid closingPrice", { status: 400 });
  }

  const trade = await prisma.trade.findFirst({
    where: { id, portfolio: { userId } },
  });
  if (!trade) return new Response("Trade not found", { status: 404 });

  if (trade.status !== "open") {
    return new Response("Trade is not open", { status: 400 });
  }
  if (!Number.isFinite(trade.contractPrice)) {
    return new Response("Trade.contractPrice missing/invalid", { status: 400 });
  }
  if (!trade.contractsOpen || trade.contractsOpen < contractsToClose) {
    return new Response("contractsToClose exceeds open contracts", {
      status: 400,
    });
  }

  // --- CHANGED: correct P&L based on long vs short
  const openPrice = Number(trade.contractPrice); // price paid (long) or credit received (short)
  let gross: number;
  let percentPL: number;

  if (isShortOption(trade.type)) {
    // sold to open → buy to close
    // P&L = (credit_at_open - debit_to_close) * 100 * contracts
    gross = (openPrice - closingPrice) * contractsToClose * CONTRACT_MULTIPLIER;
    percentPL = openPrice > 0 ? ((openPrice - closingPrice) / openPrice) * 100 : 0;
  } else if (isLongOption(trade.type)) {
    // bought to open → sell to close
    // P&L = (credit_from_close - debit_at_open) * 100 * contracts
    gross = (closingPrice - openPrice) * contractsToClose * CONTRACT_MULTIPLIER;
    percentPL = openPrice > 0 ? ((closingPrice - openPrice) / openPrice) * 100 : 0;
  } else {
    // Fallback: treat as short to avoid silent mispricing; you can also choose to 400 here.
    gross = (openPrice - closingPrice) * contractsToClose * CONTRACT_MULTIPLIER;
    percentPL = openPrice > 0 ? ((openPrice - closingPrice) / openPrice) * 100 : 0;
  }

  const feesTotal = feesPerContract * contractsToClose + flatFees;
  // P&L before normalization (already long/short aware)
  let realizedNow = gross - feesTotal;

  // Normalize saved sign so profit > 0, loss < 0
  if (percentPL >= 0 && realizedNow < 0) {
    realizedNow = Math.abs(realizedNow);
  } else if (percentPL < 0 && realizedNow > 0) {
    realizedNow = -Math.abs(realizedNow);
  }

  const remaining = trade.contractsOpen - contractsToClose;
  const fullCloseFlag = body.fullClose;
  const isFull =
    typeof fullCloseFlag === "boolean" ? fullCloseFlag : remaining <= 0;

  if (isFull) {
    // FULL CLOSE: accumulate P&L and mark closed
    const newPremiumCaptured = (trade.premiumCaptured ?? 0) + realizedNow;

    await prisma.trade.update({
      where: { id },
      data: {
        status: "closed",
        closedAt: new Date(),
        closingPrice, // last close price
        contractsOpen: 0,
        premiumCaptured: newPremiumCaptured,
        percentPL, // last-leg % (kept for display)
      },
    });

    return new Response(JSON.stringify({ realizedNow, feesTotal }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } else {
    // PARTIAL CLOSE:
    // 1) reduce original (still open) trade's contracts
    await prisma.trade.update({
      where: { id },
      data: {
        contractsOpen: remaining,
      },
    });

    // 2) create a new CLOSED trade row to record realized P&L for this leg
    await prisma.trade.create({
      data: {
        ticker: trade.ticker,
        strikePrice: trade.strikePrice,
        expirationDate: trade.expirationDate,
        createdAt: trade.createdAt,
        type: trade.type,
        contracts: contractsToClose,
        contractsInitial: contractsToClose,
        contractsOpen: 0,
        contractPrice: openPrice,
        entryPrice: trade.entryPrice, // retained for display only
        portfolioId: trade.portfolioId,
        status: "closed",
        closingPrice,
        premiumCaptured: realizedNow,
        percentPL,
        closedAt: new Date(),
      },
    });

    return new Response(JSON.stringify({ realizedNow, feesTotal, remaining }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Backward compatibility: allow POST to behave like PATCH
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  return PATCH(req, props);
}