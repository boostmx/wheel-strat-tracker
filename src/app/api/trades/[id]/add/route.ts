import { prisma } from "@/server/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import type { Trade } from "@prisma/client";

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

  // Current counts (prefer new fields, fallback to legacy)
  type TradeWithNewFields = Trade & {
    contractsOpen?: number | null;
    contractsInitial?: number | null;
  };
  const extendedTrade = trade as TradeWithNewFields;

  const existingOpen = Number(
    extendedTrade.contractsOpen ?? trade.contracts ?? 0,
  );
  const existingInitial = Number(
    extendedTrade.contractsInitial ?? trade.contracts ?? 0,
  );
  const existingContractPrice = Number(trade.contractPrice ?? 0);

  const totalOpen = Math.trunc(existingOpen + addedContracts);
  const totalInitial = Math.trunc(existingInitial + addedContracts);
  const totalPremium =
    existingContractPrice * existingOpen + addedContractPrice * addedContracts;
  const newAvgPrice =
    totalOpen > 0 ? totalPremium / totalOpen : existingContractPrice;

  const updated = await prisma.trade.update({
    where: { id },
    data: {
      contractsOpen: totalOpen,
      contractsInitial: totalInitial,
      contractPrice: newAvgPrice,
      // keep legacy field in sync while migrating UI
      contracts: totalOpen,
    },
  });

  // NOTE: We no longer update portfolio cash here since `currentCapital` was removed.
  // Cash is derived in metrics from startingCapital, additionalCapital, and open positions.

  return NextResponse.json(updated);
}
