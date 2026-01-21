import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";

// TODO (auth): enforce access by checking stockLot.portfolio.userId === session.user.id

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const params = await props.params;
    const id = params.id;

    const stockLot = await prisma.stockLot.findUnique({
      where: { id },
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