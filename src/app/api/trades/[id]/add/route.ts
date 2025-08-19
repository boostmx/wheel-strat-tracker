import { prisma } from "@/server/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await props.params;
  const id = await params.id;

  const { addedContracts, addedContractPrice } = await req.json();

  if (
    typeof addedContracts !== "number" ||
    addedContracts <= 0 ||
    typeof addedContractPrice !== "number" ||
    addedContractPrice <= 0
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const trade = await prisma.trade.findFirst({
    where: { id, portfolio: { userId } },
  });
  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  // Convert Prisma Decimal fields to numbers for arithmetic
  const existingContracts = Number(trade.contracts);
  const existingContractPrice = Number(trade.contractPrice ?? 0);

  const totalContracts = Math.trunc(existingContracts + addedContracts);
  const totalPremium =
    existingContractPrice * existingContracts +
    addedContractPrice * addedContracts;

  const newAvgPrice = totalPremium / totalContracts;

  const updated = await prisma.trade.update({
    where: { id },
    data: {
      contracts: totalContracts,
      contractPrice: newAvgPrice,
    },
  });

  // NOTE: We no longer update portfolio cash here since `currentCapital` was removed.
  // Cash is derived in metrics from startingCapital, additionalCapital, and open positions.

  return NextResponse.json(updated);
}
