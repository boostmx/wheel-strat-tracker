export type TradeCapitalParams = {
  type?: string | null;
  strikePrice?: number | null;
  contractsOpen?: number | null;
  contractPrice?: number | null;
};

const isCSP = (type: string | null | undefined) => {
  const t = (type ?? "").toLowerCase();
  return t === "cash secured put" || t === "cashsecuredput" || t === "csp";
};

const isCC = (type: string | null | undefined) => {
  const t = (type ?? "").toLowerCase();
  return t === "covered call" || t === "coveredcall" || t === "cc";
};

const isLongOption = (type: string | null | undefined) => {
  const t = (type ?? "").toLowerCase();
  return t === "put" || t === "call";
};

/**
 * Capital tied up by a trade:
 *   CSP  → strike collateral (strike × 100 × contracts)
 *   CC   → 0  (underlying shares are tracked separately as a StockLot)
 *   Long → premium at risk (price × 100 × contracts)
 */
export function capitalUsedForTrade(row: TradeCapitalParams): number {
  const contracts = Math.max(0, Number(row.contractsOpen ?? 0));
  const strike = Math.max(0, Number(row.strikePrice ?? 0));
  const px = Math.max(0, Number(row.contractPrice ?? 0));
  if (isCSP(row.type)) return strike * 100 * contracts;
  if (isCC(row.type)) return 0;
  if (isLongOption(row.type)) return px * 100 * contracts;
  return 0;
}
