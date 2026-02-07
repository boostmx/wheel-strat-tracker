import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { Prisma } from "@prisma/client";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toNumber(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
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

    const params = await props.params;
    const id = params.id;

    const stockLot = await prisma.stockLot.findFirst({
      where: {
        id,
        portfolio: { userId },
      },
      include: {
        trades: {
          orderBy: { createdAt: "desc" },
        },
        sales: {
          orderBy: { soldAt: "desc" },
        }
      },
    });

    if (!stockLot) {
      return NextResponse.json({ error: "StockLot not found" }, { status: 404 });
    }

    return NextResponse.json({ stockLot });
  } catch (err) {
    console.error("GET /api/stocks/[id] failed", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await props.params;
    const id = params.id;

    const bodyUnknown: unknown = await req.json().catch(() => ({}));
    const body = bodyUnknown as { closePrice?: number | string | null };

    const closePriceNum = toNumber(body.closePrice);
    if (!Number.isFinite(closePriceNum) || closePriceNum <= 0) {
      return badRequest("closePrice must be a positive number");
    }

    // Load lot with ownership + current basis
    const lot = await prisma.stockLot.findFirst({
      where: {
        id,
        portfolio: { userId },
      },
      select: {
        id: true,
        status: true,
        shares: true,
        avgCost: true,
      },
    });

    if (!lot) {
      return NextResponse.json({ error: "StockLot not found" }, { status: 404 });
    }

    if (lot.status === "CLOSED") {
      return badRequest("StockLot is already closed");
    }

    const sharesInt = Number(lot.shares);
    if (!Number.isFinite(sharesInt) || sharesInt <= 0) {
      return badRequest("StockLot has no shares to close");
    }

    // realizedPnl = (closePrice - avgCost) * shares
    const shares = new Prisma.Decimal(sharesInt);
    const avgCost = new Prisma.Decimal(lot.avgCost);
    const closePrice = new Prisma.Decimal(closePriceNum);

    const realizedPnl = closePrice.sub(avgCost).mul(shares);

    const updated = await prisma.stockLot.update({
      where: { id: lot.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closePrice: closePrice,
        realizedPnl: realizedPnl,
      },
      include: {
        trades: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ stockLot: updated });
  } catch (err) {
    console.error("PATCH /api/stocks/[id] failed", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}