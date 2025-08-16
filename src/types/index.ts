// types/index.ts
export interface Trade {
  id: string;
  portfolioId: string;
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
  notes?: string | null;
  status: "open" | "closed";
  totalContracts?: number;
  createdAt: string;
}

export interface Portfolio {
  id: string;
  name: string | null;
  startingCapital: number;
  additionalCapital: number;
  capitalUsed?: number;
}

export interface Metrics {
  startingCapital: number;
  capitalUsed?: number;
  winRate: number | null;
  totalProfit: number | null;
  avgPLPercent: number | null;
  percentCapitalDeployed: number | null;
  avgDaysInTrade: number | null;
  potentialPremium?: number | null;
  realizedMTD?: number | null;
  realizedYTD?: number | null;
}
