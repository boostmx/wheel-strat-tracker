// types/index.ts
export interface Trade {
  id: string;
  ticker: string;
  strikePrice: number;
  expirationDate: string;
  type: string;
  contracts: number;
  contractPrice: number;
  closedAt?: string | null;
  premiumCaptured?: number | null;
}

export interface Portfolio {
  id: string;
  name: string | null;
  startingCapital: number;
  currentCapital: number;
}
