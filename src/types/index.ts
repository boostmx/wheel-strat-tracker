// types/index.ts
export interface Trade {
  id: string;
  ticker: string;
  strikePrice: number;
  entryPrice?: number;
  expirationDate: string;
  type: string;
  contracts: number;
  contractPrice: number;
  closingPrice?: number;
  closedAt?: string | null;
  premiumCaptured?: number | null;
  percentPL?: number | null;
}

export interface Portfolio {
  id: string;
  name: string | null;
  startingCapital: number;
  currentCapital: number;
}
