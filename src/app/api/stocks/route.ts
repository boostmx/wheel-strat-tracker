import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/prisma";

type StockLotStatusQuery = "open" | "closed";

function parseStatus(value: string | null): Prisma.StockLotWhereInput["status"] | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase() as StockLotStatusQuery;
  if (v === "open") return "OPEN";
  if (v === "closed") return "CLOSED";
  return undefined;
}

// TODO (auth): enforce portfolio ownership once you plug in session
// async function assertPortfolioAccess(_portfolioId: string): Promise<void> { ... }

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const portfolioId = url.searchParams.get("portfolioId");
    const status = parseStatus(url.searchParams.get("status"));

    if (!portfolioId) {
      return NextResponse.json({ error: "Missing portfolioId" }, { status: 400 });
    }

    // await assertPortfolioAccess(portfolioId);

    const stockLots = await prisma.stockLot.findMany({
      where: {
        portfolioId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ stockLots });
  } catch (err) {
    console.error("GET /api/stocks failed", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

type CreateStockLotBody = {
  portfolioId: string;
  ticker: string;
  shares: number;
  avgCost: number;
  notes?: string | null;
};

function isCreateBody(value: unknown): value is CreateStockLotBody {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  return (
    typeof v.portfolioId === "string" &&
    typeof v.ticker === "string" &&
    typeof v.shares === "number" &&
    typeof v.avgCost === "number" &&
    (typeof v.notes === "string" || v.notes === null || typeof v.notes === "undefined")
  );
}

export async function POST(req: Request) {
  try {
    const bodyUnknown: unknown = await req.json();

    if (!isCreateBody(bodyUnknown)) {
      return NextResponse.json(
        { error: "Invalid body. Expected { portfolioId, ticker, shares, avgCost, notes? }" },
        { status: 400 },
      );
    }

    const { portfolioId } = bodyUnknown;
    const ticker = bodyUnknown.ticker.trim().toUpperCase();
    const shares = Math.trunc(bodyUnknown.shares);
    const avgCost = bodyUnknown.avgCost;
    const notes = bodyUnknown.notes ?? null;

    if (!ticker) return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
    if (!Number.isFinite(shares) || shares <= 0) {
      return NextResponse.json({ error: "Shares must be a positive integer" }, { status: 400 });
    }
    if (!Number.isFinite(avgCost) || avgCost <= 0) {
      return NextResponse.json({ error: "avgCost must be a positive number" }, { status: 400 });
    }

    // await assertPortfolioAccess(portfolioId);

    const created = await prisma.stockLot.create({
      data: {
        portfolioId,
        ticker,
        shares,
        avgCost: new Prisma.Decimal(avgCost),
        notes,
      },
    });

    return NextResponse.json({ stockLot: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/stocks failed", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}