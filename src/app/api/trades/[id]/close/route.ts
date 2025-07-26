import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const id = await params.id;

  const { contractsToClose, closingPrice, fullClose } = await req.json();

  if (!contractsToClose || !closingPrice) {
    return new Response("Missing data", { status: 400 });
  }

  const trade = await prisma.trade.findUnique({ where: { id } });

  if (!trade) {
    return new Response("Trade not found", { status: 404 });
  }

  const entry = trade.entryPrice ?? trade.contractPrice;
  const premiumCaptured = (entry - closingPrice) * contractsToClose * 100;
  const percentPL = (premiumCaptured / (entry * contractsToClose * 100)) * 100;

  if (fullClose || contractsToClose === trade.contracts) {
    await prisma.trade.update({
      where: { id },
      data: {
        status: "closed",
        closedAt: new Date(),
        closingPrice,
        premiumCaptured,
        percentPL,
      },
    });
  } else {
    // Partial close: update original trade, create new one
    await prisma.trade.update({
      where: { id },
      data: {
        contracts: trade.contracts - contractsToClose,
      },
    });

    await prisma.trade.create({
      data: {
        ticker: trade.ticker,
        strikePrice: trade.strikePrice,
        expirationDate: trade.expirationDate,
        type: trade.type,
        contracts: contractsToClose,
        contractPrice: trade.contractPrice,
        entryPrice: trade.entryPrice,
        portfolioId: trade.portfolioId,
        status: "closed",
        closingPrice,
        premiumCaptured,
        percentPL,
        closedAt: new Date(),
      },
    });
  }

  return new Response("OK");
}
