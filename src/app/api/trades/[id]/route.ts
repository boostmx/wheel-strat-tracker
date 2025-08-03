import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET request to fetch a single trade by its ID.
 */
export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;

  try {
    const trade = await prisma.trade.findUnique({
      where: { id },
    });

    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    return NextResponse.json(trade);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/***
 * PATCH request to update a trade's expiration date and notes.
 *
 */
export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const body = await req.json();

  const { expirationDate, notes } = body;

  if (!expirationDate) {
    return NextResponse.json(
      { error: "Missing expirationDate" },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.trade.update({
      where: { id },
      data: {
        expirationDate: new Date(expirationDate),
        notes,
      },
    });

    return NextResponse.json({ success: true, trade: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
