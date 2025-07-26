import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
  } = body;

  if (
    !portfolioId ||
    !ticker ||
    !strikePrice ||
    !expirationDate ||
    !type ||
    !contracts ||
    !contractPrice
  ) {
    return NextResponse.json(
      { error: "Missing required trade data" },
      { status: 400 },
    );
  }

  try {
    const trade = await db.trade.create({
      data: {
        portfolioId,
        ticker: ticker.toUpperCase(),
        strikePrice,
        expirationDate: new Date(expirationDate),
        type,
        contracts,
        contractPrice,
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
