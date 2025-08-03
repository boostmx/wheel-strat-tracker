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
  createdAt: string | null;
  premiumCaptured?: number | null;
  percentPL?: number | null;
  notes?: string | null;
  tradeAdjustments?: TradeAdjustment[];
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

export interface TradeAdjustment {
  id: string;
  tradeId: string;
  contracts: number;
  price: number;
  notes?: string | null;
  addedAt: string | null;
}
