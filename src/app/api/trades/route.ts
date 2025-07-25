import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
        type, // must match your enum, e.g., "PUT", "CALL", etc.
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
