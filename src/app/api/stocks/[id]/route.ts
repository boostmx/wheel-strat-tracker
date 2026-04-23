import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { Prisma } from "@prisma/client";
import { getEffectiveUserId } from "@/server/auth/getEffectiveUserId";

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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isAdmin = session.user.isAdmin ?? false;
    const userId = await getEffectiveUserId(session.user.id, isAdmin);

    const params = await props.params;
    const id = params.id;

    const stockLot = await prisma.stockLot.findFirst({
      where: {
        id,
        portfolio: isAdmin ? undefined : { userId },
      },
      include: {
        trades: {
          orderBy: { createdAt: "desc" },
        },
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isAdmin = session.user.isAdmin ?? false;
    const userId = await getEffectiveUserId(session.user.id, isAdmin);

    const params = await props.params;
    const id = params.id;

    const bodyUnknown: unknown = await req.json().catch(() => ({}));
    const body = bodyUnknown as {
      closePrice?: number | string | null;
      // Admin-only direct-edit fields
      adminEdit?: boolean;
      ticker?: string;
      shares?: number | string;
      avgCost?: number | string;
      openedAt?: string;
      notes?: string | null;
      closedAt?: string | null;
      realizedPnl?: number | string | null;
    };

    // Admin direct-edit path — correct individual fields without triggering close logic
    if (isAdmin && body.adminEdit) {
      const updates: Prisma.StockLotUpdateInput = {};
      if (typeof body.ticker === "string" && body.ticker.trim()) {
        updates.ticker = body.ticker.trim().toUpperCase();
      }
      if (body.shares !== undefined) {
        const s = parseInt(String(body.shares), 10);
        if (!isNaN(s) && s > 0) updates.shares = s;
      }
      if (body.avgCost !== undefined) {
        const a = toNumber(body.avgCost);
        if (Number.isFinite(a) && a >= 0) updates.avgCost = new Prisma.Decimal(a);
      }
      if (body.openedAt) {
        const d = new Date(body.openedAt);
        if (!isNaN(d.getTime())) updates.openedAt = d;
      }
      if (body.notes !== undefined) updates.notes = body.notes;
      if (body.closedAt !== undefined) {
        updates.closedAt = body.closedAt ? new Date(body.closedAt) : null;
      }
      if (body.closePrice !== undefined && body.closePrice !== null) {
        const cp = toNumber(body.closePrice);
        if (Number.isFinite(cp)) updates.closePrice = new Prisma.Decimal(cp);
      }
      if (body.realizedPnl !== undefined && body.realizedPnl !== null) {
        const pnl = toNumber(body.realizedPnl);
        if (Number.isFinite(pnl)) updates.realizedPnl = new Prisma.Decimal(pnl);
      }

      const updated = await prisma.stockLot.update({
        where: { id },
        data: updates,
        include: { trades: { orderBy: { createdAt: "desc" } } },
      });
      return NextResponse.json({ stockLot: updated });
    }

    // Standard close path
    const closePriceNum = toNumber(body.closePrice);
    if (!Number.isFinite(closePriceNum) || closePriceNum <= 0) {
      return badRequest("closePrice must be a positive number");
    }

    // Load lot with ownership + current basis
    const lot = await prisma.stockLot.findFirst({
      where: {
        id,
        portfolio: isAdmin ? undefined : { userId },
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