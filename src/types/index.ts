// types/index.ts
export interface Trade {
  id: string;
  portfolioId: string;
  ticker: string;
  strikePrice: number;
  entryPrice?: number;
  expirationDate: string;
  type: string;
  contracts: number; // legacy field but keeping for backward compatibility with existing data
  contractsInitial: number;
  contractsOpen: number;
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
  notes?: string | null;
}

export interface Metrics {
  startingCapital: number;
  capitalUsed?: number;
  capitalBase?: number;
  cashAvailable?: number;
  winRate: number | null;
  totalProfit: number | null;
  avgPLPercent: number | null;
  percentCapitalDeployed: number | null;
  avgDaysInTrade: number | null;
  potentialPremium?: number | null;
  realizedMTD?: number | null;
  realizedYTD?: number | null;
}

export type StockLotStatus = "OPEN" | "CLOSED";

export type StockLot = {
  id: string;
  portfolioId: string;
  ticker: string;
  shares: number;
  avgCost: string | number; // Prisma Decimal often serializes as string
  status: StockLotStatus;
  openedAt: string;
  closedAt: string | null;
  closePrice: string | number | null;
  realizedPnl: string | number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StocksListResponse = {
  stockLots: StockLot[];
};

export type CreateStockBody = {
  portfolioId: string;
  ticker: string;
  shares: number;
  avgCost: number;
  notes?: string | null;
};

export type CreateStockResponse = {
  stockLot: StockLot;
};