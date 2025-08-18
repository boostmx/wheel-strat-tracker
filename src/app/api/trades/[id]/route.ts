// src/app/api/trades/[id]/route.ts
import { prisma } from "@/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { NextResponse } from "next/server";
import { Prisma, TradeType } from "@prisma/client";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const trade = await prisma.trade.findUnique({
    where: { id },
  });

  if (!trade) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.json(trade);
}

// Edit a trade
// Only allow updating specific fields: notes, strikePrice, contracts, contractPrice, expirationDate
// This is a PATCH request
export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  type PatchBody = {
    notes?: string;
    strikePrice?: number;
    contracts?: number;
    contractPrice?: number;
    expirationDate?: string | Date;
    type?: TradeType | string;
  };
  const body = (await req.json().catch(() => ({}))) as PatchBody;

  // Only allow known fields to be updated
  const { notes, strikePrice, contracts, contractPrice, expirationDate, type } =
    body;

  const updates: Prisma.TradeUpdateInput = {};
  if (typeof notes === "string") updates.notes = notes;
  if (typeof strikePrice === "number") updates.strikePrice = strikePrice;
  if (typeof contracts === "number") updates.contracts = contracts;
  if (typeof contractPrice === "number") updates.contractPrice = contractPrice;
  if (typeof expirationDate === "string" || expirationDate instanceof Date) {
    const d = new Date(expirationDate);
    if (!isNaN(d.getTime())) {
      updates.expirationDate = d;
    }
  }
  if (
    typeof type === "string" &&
    (Object.values(TradeType) as string[]).includes(type)
  ) {
    updates.type = type as TradeType;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const updated = await prisma.trade.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json(updated);
}
