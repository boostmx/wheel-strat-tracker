import { describe, it, expect } from "vitest";
import { capitalUsedForTrade } from "@/lib/tradeMetrics";

describe("capitalUsedForTrade", () => {
  it("CSP: strike × 100 × contracts", () => {
    expect(capitalUsedForTrade({ type: "CashSecuredPut", strikePrice: 200, contractsOpen: 3, contractPrice: 2 }))
      .toBe(60000);
  });

  it("CC: always 0 (capital tracked via StockLot)", () => {
    expect(capitalUsedForTrade({ type: "CoveredCall", strikePrice: 200, contractsOpen: 4, contractPrice: 2 }))
      .toBe(0);
  });

  it("long Put/Call: premium × 100 × contracts", () => {
    expect(capitalUsedForTrade({ type: "Put", strikePrice: 200, contractsOpen: 2, contractPrice: 3.5 }))
      .toBe(700);
    expect(capitalUsedForTrade({ type: "Call", strikePrice: 200, contractsOpen: 2, contractPrice: 3.5 }))
      .toBe(700);
  });

  it("accepts lowercase / abbreviated type strings", () => {
    expect(capitalUsedForTrade({ type: "csp", strikePrice: 100, contractsOpen: 1, contractPrice: 1 }))
      .toBe(10000);
    expect(capitalUsedForTrade({ type: "cc", strikePrice: 100, contractsOpen: 1, contractPrice: 1 }))
      .toBe(0);
  });

  it("floors at 0 when values are missing/null", () => {
    expect(capitalUsedForTrade({ type: "CashSecuredPut", strikePrice: null, contractsOpen: null, contractPrice: null }))
      .toBe(0);
  });
});
