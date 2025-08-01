import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
/***
 * PATCH request to update a trade's entry price, expiration date, and notes.
 * 
 */
export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const body = await req.json();

  const { entryPrice, expirationDate, notes } = body;

  if (!expirationDate) {
    return NextResponse.json({ error: "Missing expirationDate" }, { status: 400 });
  }

  try {
    const updated = await prisma.trade.update({
      where: { id },
      data: {
        entryPrice: entryPrice === null ? null : Number(entryPrice),
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