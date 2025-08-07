// src/app/api/trades/[id]/route.ts
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> }
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