import { prisma } from "@/server/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth/auth";
import { getEffectiveUserId } from "@/server/auth/getEffectiveUserId";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: portfolioId } = await props.params;
  const userId = await getEffectiveUserId(session.user.id, session.user.isAdmin ?? false);
  const isAdmin = session.user.isAdmin ?? false;

  const portfolioWhere = isAdmin ? { id: portfolioId } : { id: portfolioId, userId };
  const portfolio = await prisma.portfolio.findFirst({ where: portfolioWhere, select: { id: true } });
  if (!portfolio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const transactions = await prisma.capitalTransaction.findMany({
    where: { portfolioId },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ transactions });
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: portfolioId } = await props.params;
  const userId = await getEffectiveUserId(session.user.id, session.user.isAdmin ?? false);
  const isAdmin = session.user.isAdmin ?? false;

  const portfolioWhere = isAdmin ? { id: portfolioId } : { id: portfolioId, userId };
  const portfolio = await prisma.portfolio.findFirst({ where: portfolioWhere, select: { id: true } });
  if (!portfolio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { type, amount, note, date } = body;

  if (!["deposit", "withdrawal"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  const transaction = await prisma.capitalTransaction.create({
    data: {
      portfolioId,
      type,
      amount: new Prisma.Decimal(parsedAmount),
      note: note?.trim() || null,
      date: date ? new Date(date) : new Date(),
    },
  });

  return NextResponse.json({ transaction }, { status: 201 });
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: portfolioId } = await props.params;
  const userId = await getEffectiveUserId(session.user.id, session.user.isAdmin ?? false);
  const isAdmin = session.user.isAdmin ?? false;

  const portfolioWhere = isAdmin ? { id: portfolioId } : { id: portfolioId, userId };
  const portfolio = await prisma.portfolio.findFirst({ where: portfolioWhere, select: { id: true } });
  if (!portfolio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { transactionId } = await req.json();
  if (!transactionId) {
    return NextResponse.json({ error: "transactionId required" }, { status: 400 });
  }

  const deleted = await prisma.capitalTransaction.deleteMany({
    where: { id: transactionId, portfolioId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
