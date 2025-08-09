import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const id = await params.id;

  const body = await req.json().catch(() => ({}));
  const contractsToClose = Number(body.contractsToClose);
  const closingPrice = Number(body.closingPrice);
  const fullClose = Boolean(body.fullClose);
  // Optional fees support (defaults 0)
  const feesPerContract = Number(body.feesPerContract ?? 0);
  const flatFees = Number(body.flatFees ?? 0);

  if (!Number.isFinite(contractsToClose) || contractsToClose <= 0) {
    return new Response("Invalid contractsToClose", { status: 400 });
  }
  if (!Number.isFinite(closingPrice) || closingPrice < 0) {
    return new Response("Invalid closingPrice", { status: 400 });
  }

  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade) return new Response("Trade not found", { status: 404 });

  if (trade.status !== "open") {
    return new Response("Trade is not open", { status: 400 });
  }
  if (!Number.isFinite(trade.contractPrice)) {
    return new Response("Trade.contractPrice missing/invalid", { status: 400 });
  }
  if (!trade.contracts || trade.contracts < contractsToClose) {
    return new Response("contractsToClose exceeds open contracts", { status: 400 });
  }

  // OPTION P&L ONLY — do NOT use strike or stock entry price
  const sellPrice = Number(trade.contractPrice); // avg credit per contract at open (e.g., 4.50)
  const gross = (sellPrice - closingPrice) * contractsToClose * 100;
  const feesTotal = feesPerContract * contractsToClose + flatFees;
  const realizedNow = gross - feesTotal;

  const percentPL =
    sellPrice > 0 ? ((sellPrice - closingPrice) / sellPrice) * 100 : 0;

  const remaining = trade.contracts - contractsToClose;
  const isFull = fullClose || remaining <= 0;

  if (isFull) {
    // FULL CLOSE: accumulate P&L and mark closed
    const newPremiumCaptured = (trade.premiumCaptured ?? 0) + realizedNow;

    await prisma.trade.update({
      where: { id },
      data: {
        status: "closed",
        closedAt: new Date(),
        closingPrice,                     // last close price
        contracts: 0,
        premiumCaptured: newPremiumCaptured,
        percentPL,                        // last-leg % (optional; could also compute weighted)
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
        contracts: remaining,
      },
    });

    // 2) create a new CLOSED trade row to record realized P&L for this leg
    await prisma.trade.create({
      data: {
        ticker: trade.ticker,
        strikePrice: trade.strikePrice,
        expirationDate: trade.expirationDate,
        type: trade.type,
        contracts: contractsToClose,
        contractPrice: sellPrice,       // credit at open (avg)
        entryPrice: trade.entryPrice,   // keep if you display it, but not used in P&L
        portfolioId: trade.portfolioId,
        status: "closed",
        closingPrice,
        premiumCaptured: realizedNow,   // realized for this partial close
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