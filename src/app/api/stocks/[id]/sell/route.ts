import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";

type SellSharesPayload = {
  sharesSold: number;
  salePrice: number;
  fees?: number;
  notes?: string;
};

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: stockLotId } = await props.params;

  const body = (await req.json().catch(() => ({}))) as SellSharesPayload;
  const sharesSold = Math.trunc(Number(body.sharesSold));
  const salePrice = Number(body.salePrice);
  const fees = Number(body.fees ?? 0);
  const notes = typeof body.notes === "string" ? body.notes : undefined;

  if (!Number.isFinite(sharesSold) || sharesSold <= 0) {
    return NextResponse.json({ error: "Invalid sharesSold" }, { status: 400 });
  }
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    return NextResponse.json({ error: "Invalid salePrice" }, { status: 400 });
  }
  if (!Number.isFinite(fees) || fees < 0) {
    return NextResponse.json({ error: "Invalid fees" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const lot = await tx.stockLot.findFirst({
        where: { id: stockLotId, portfolio: { userId } },
        select: { id: true, shares: true, avgCost: true, status: true, realizedPnl: true },
      });

      if (!lot) throw new Error("StockLot not found");
      if (lot.status !== "OPEN") throw new Error("StockLot is not OPEN");

      // shares reserved by OPEN covered calls
      const openCC = await tx.trade.aggregate({
        where: {
          stockLotId,
          status: "open",
          type: "CoveredCall",
        },
        _sum: { contractsOpen: true },
      });

      const reservedShares = Math.max(0, Number(openCC._sum.contractsOpen ?? 0)) * 100;
      const availableToSell = lot.shares - reservedShares;

      if (sharesSold > availableToSell) {
        throw new Error(
          `Cannot sell ${sharesSold} shares. ${reservedShares} shares reserved by open covered calls. Available: ${availableToSell}.`,
        );
      }

      const avgCost = new Prisma.Decimal(lot.avgCost);
      const realized = new Prisma.Decimal(salePrice)
        .mul(new Prisma.Decimal(sharesSold))
        .sub(avgCost.mul(new Prisma.Decimal(sharesSold)))
        .sub(new Prisma.Decimal(fees));

      const existingRealized = lot.realizedPnl ?? new Prisma.Decimal(0);
      const cumulativeRealized = existingRealized.add(realized);

      const sale = await tx.stockLotSale.create({
        data: {
          stockLotId,
          sharesSold,
          salePrice: new Prisma.Decimal(salePrice),
          fees: fees > 0 ? new Prisma.Decimal(fees) : null,
          realizedPnl: realized,
          notes,
          source: "manual",
        },
      });

      const newShares = lot.shares - sharesSold;
      const closeLot = newShares === 0;

      await tx.stockLot.update({
        where: { id: stockLotId },
        data: closeLot
          ? {
              shares: 0,
              status: "CLOSED",
              closedAt: new Date(),
              closePrice: new Prisma.Decimal(salePrice),
              realizedPnl: cumulativeRealized,
            }
          : { shares: newShares, realizedPnl: cumulativeRealized },
      });

      return { sale, reservedShares, availableToSell, newShares, cumulativeRealized: cumulativeRealized.toFixed(2) };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}