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
  createdAt: string | null
  premiumCaptured?: number | null;
  percentPL?: number | null;
  notes?: string | null;
}

export interface Portfolio {
  id: string;
  name: string | null;
  startingCapital: number;
  currentCapital: number;
  capitalUsed?: number;
}

export interface Metrics {
  winRate: number | null;
  totalReturn: number | null;
  annualizedReturn: number | null;
  maxDrawdown: number | null;
  sharpeRatio: number | null;
  capitalUsed?: number;
}
