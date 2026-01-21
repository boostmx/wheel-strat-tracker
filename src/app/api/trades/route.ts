import { NextResponse } from "next/server";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";

/**
 * POST Route to create a new trade
 * @param req
 * @returns
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await req.json();

  const {
    portfolioId,
    ticker,
    strikePrice,
    expirationDate,
    type,
    contracts,
    contractPrice,
    entryPrice,
    stockLotId,
  } = body;

  if (
    !portfolioId ||
    !ticker ||
    !strikePrice ||
    !expirationDate ||
    !type ||
    !contracts ||
    !contractPrice ||
    !entryPrice
  ) {
    return NextResponse.json(
      { error: "Missing required trade data" },
      { status: 400 },
    );
  }

  const normalizedType = String(type).toLowerCase();

  if (normalizedType === "coveredcall" || normalizedType === "covered call" || normalizedType === "cc") {
    if (!stockLotId) {
      return NextResponse.json(
        { error: "Covered calls must be linked to an underlying stock lot" },
        { status: 400 },
      );
    }

    const stockLot = await db.stockLot.findFirst({
      where: {
        id: stockLotId,
        portfolioId,
        status: "OPEN",
      },
    });

    if (!stockLot) {
      return NextResponse.json(
        { error: "Invalid or closed stock lot for covered call" },
        { status: 400 },
      );
    }

    if (stockLot.ticker.toUpperCase() !== ticker.toUpperCase()) {
      return NextResponse.json(
        { error: "Covered call ticker must match stock lot ticker" },
        { status: 400 },
      );
    }

    const requiredShares = Number(contracts) * 100;
    if (stockLot.shares < requiredShares) {
      return NextResponse.json(
        { error: "Not enough shares in stock lot for covered call" },
        { status: 400 },
      );
    }
  }

  try {
    const trade = await db.trade.create({
      data: {
        portfolioId,
        stockLotId: stockLotId ?? null,
        ticker: ticker.toUpperCase(),
        strikePrice,
        expirationDate: new Date(expirationDate),
        type,
        contracts,
        contractsInitial: contracts,
        contractsOpen: contracts,
        contractPrice,
        entryPrice,
        status: "open",
      },
    });

    return NextResponse.json(trade, { status: 201 });
  } catch (error) {
    console.error("Trade creation error:", error);
    return NextResponse.json(
      { error: "Failed to create trade" },
      { status: 500 },
    );
  }
}
/**
 * GET Route to fetch trades based on status and portfolioId
 * @param req
 * @returns
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as "open" | "closed" | null;
  const portfolioId = searchParams.get("portfolioId");

  if (!status || !portfolioId) {
    return new NextResponse("Missing status or portfolioId", { status: 400 });
  }

  try {
    const trades = await db.trade.findMany({
      where: {
        status,
        portfolioId,
      },
      orderBy:
        status === "closed" ? { closedAt: "desc" } : { createdAt: "asc" },
    });

    return NextResponse.json(trades);
  } catch (error) {
    console.error("Error fetching trades:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
