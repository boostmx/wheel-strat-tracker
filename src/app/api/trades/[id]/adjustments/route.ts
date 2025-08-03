import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id: tradeId } = await props.params;
  const body = await req.json();

  const { contracts, price, notes } = body;

  if (!contracts || !price || isNaN(contracts) || isNaN(price)) {
    return NextResponse.json(
      { error: "Contracts and price are required and must be numbers." },
      { status: 400 },
    );
  }

  try {
    const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    const adjustment = await prisma.tradeAdjustment.create({
      data: {
        tradeId,
        contracts,
        price,
        notes,
      },
    });

    return NextResponse.json(adjustment, { status: 201 });
  } catch (err) {
    console.error("Error creating trade adjustment:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
