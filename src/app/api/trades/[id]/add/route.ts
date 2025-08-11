import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
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

  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade)
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  const totalContracts = trade.contracts + addedContracts;
  const totalPremium =
    trade.contractPrice * trade.contracts + addedContractPrice * addedContracts;

  const newAvgPrice = totalPremium / totalContracts;

  const updated = await prisma.trade.update({
    where: { id },
    data: {
      contracts: totalContracts,
      contractPrice: newAvgPrice,
    },
  });

  // Auto-capital adjustment: only for CSPs (Cash Secured Put)
  if (trade.type === "CashSecuredPut") {
    await prisma.portfolio.update({
      where: { id: trade.portfolioId },
      data: {
        currentCapital: {
          decrement: addedContracts * 100 * addedContractPrice,
        },
      },
    });
  }

  return NextResponse.json(updated);
}
