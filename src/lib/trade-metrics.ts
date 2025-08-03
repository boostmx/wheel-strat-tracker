import { Trade } from "@/types";

export function calculateAdjustedContracts(trade: Trade): number {
  const base = trade.contracts ?? 0;
  const adjustments = trade.tradeAdjustments ?? [];
  const additional = adjustments.reduce((acc, a) => acc + a.contracts, 0);
  return base + additional;
}

export function calculateAverageContractPrice(trade: Trade): number {
  const baseContracts = trade.contracts ?? 0;
  const baseTotal = (trade.contractPrice ?? 0) * baseContracts;

  const adjustments = trade.tradeAdjustments ?? [];
  const adjustmentsTotal = adjustments.reduce(
    (acc, a) => acc + a.price * a.contracts,
    0,
  );
  const adjustmentsContracts = adjustments.reduce(
    (acc, a) => acc + a.contracts,
    0,
  );

  const totalContracts = baseContracts + adjustmentsContracts;
  const totalCost = baseTotal + adjustmentsTotal;

  if (totalContracts === 0) return 0;

  return totalCost / totalContracts;
}
