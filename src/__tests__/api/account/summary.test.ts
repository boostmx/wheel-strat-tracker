import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { mockSession } from "../../helpers/mocks";

const { mockGetServerSession, mockGetEffectiveUserId, mockPortfolioFindMany, mockTradeFindMany, mockStockLotFindMany } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetEffectiveUserId: vi.fn().mockResolvedValue("user-1"),
  mockPortfolioFindMany: vi.fn(),
  mockTradeFindMany: vi.fn(),
  mockStockLotFindMany: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/server/auth/getEffectiveUserId", () => ({ getEffectiveUserId: mockGetEffectiveUserId }));
vi.mock("@/server/prisma", () => ({
  prisma: {
    portfolio: { findMany: mockPortfolioFindMany },
    trade: { findMany: mockTradeFindMany },
    stockLot: { findMany: mockStockLotFindMany },
  },
}));

import { GET } from "@/app/api/account/summary/route";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
const now = new Date();
const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

function makePortfolio(id = "port-1", startingCapital = 10000) {
  return {
    id,
    name: `Portfolio ${id}`,
    startingCapital: new Prisma.Decimal(startingCapital),
    capitalTransactions: [],
  };
}

function makeOpenCSP(ticker = "AAPL", strike = 200, contracts = 2) {
  return {
    id: `trade-open-${ticker}`,
    ticker,
    type: "CashSecuredPut",
    strikePrice: strike,
    contractsOpen: contracts,
    expirationDate: futureDate,
    createdAt: twoWeeksAgo,
    contractPrice: 3.5,
  };
}

function makeOpenCC(ticker = "AAPL") {
  return {
    id: `trade-cc-${ticker}`,
    ticker,
    type: "CoveredCall",
    strikePrice: 210,
    contractsOpen: 2,
    expirationDate: futureDate,
    createdAt: twoWeeksAgo,
    contractPrice: 2.0,
  };
}

function makeClosedTrade(ticker = "AAPL", premiumCaptured = 500, closedAt = twoWeeksAgo) {
  return {
    ticker,
    type: "CashSecuredPut",
    contracts: 2,
    contractPrice: 3.5,
    closingPrice: null,
    premiumCaptured,
    createdAt: oneMonthAgo,
    closedAt,
    closeReason: "expiredWorthless",
  };
}

// The route makes 6 findMany calls per portfolio (open, closedAll, closedMTD, closedYTD, closed90, stockLots)
// plus initial portfolios load. We set up a helper that returns the right sequence.
function setupOnPortfolio({
  openTrades = [],
  closedAll = [],
  stockLots = [],
}: {
  openTrades?: ReturnType<typeof makeOpenCSP>[];
  closedAll?: ReturnType<typeof makeClosedTrade>[];
  stockLots?: unknown[];
} = {}) {
  // For each portfolio, the route calls trade.findMany 5 times (open, all, MTD, YTD, 90d)
  // and stockLot.findMany once.
  // We use mockResolvedValueOnce chains.
  mockTradeFindMany
    .mockResolvedValueOnce(openTrades)   // open
    .mockResolvedValueOnce(closedAll)    // closedAll
    .mockResolvedValueOnce(closedAll.filter(t => t.closedAt && t.closedAt >= new Date(now.getFullYear(), now.getMonth(), 1))) // MTD
    .mockResolvedValueOnce(closedAll.filter(t => t.closedAt && t.closedAt >= new Date(now.getFullYear(), 0, 1))) // YTD
    .mockResolvedValueOnce(closedAll);   // 90d

  mockStockLotFindMany.mockResolvedValueOnce(stockLots);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockGetEffectiveUserId.mockResolvedValue("user-1");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/account/summary — auth", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/account/summary — empty portfolios", () => {
  it("returns zeroed totals when user has no portfolios", async () => {
    mockPortfolioFindMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { totals: Record<string, number>; perPortfolio: Record<string, unknown> };
    expect(body.totals.portfolioCount).toBe(0);
    expect(body.totals.capitalBase).toBe(0);
    expect(body.perPortfolio).toEqual({});
  });
});

describe("GET /api/account/summary — with portfolio data", () => {
  beforeEach(() => {
    mockPortfolioFindMany.mockResolvedValue([makePortfolio()]);
  });

  it("returns response with perPortfolio, totals, topTickers, nextExpiration", async () => {
    setupOnPortfolio();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.perPortfolio).toBeDefined();
    expect(body.totals).toBeDefined();
    expect(Array.isArray(body.topTickers)).toBe(true);
  });

  it("computes capitalBase from startingCapital + capital transactions", async () => {
    mockPortfolioFindMany.mockResolvedValue([{
      ...makePortfolio(),
      capitalTransactions: [
        { type: "deposit", amount: new Prisma.Decimal("2000") },
        { type: "withdrawal", amount: new Prisma.Decimal("500") },
      ],
    }]);
    setupOnPortfolio();
    const res = await GET();
    const body = await res.json() as { totals: { capitalBase: number } };
    expect(body.totals.capitalBase).toBe(11500); // 10000 + 2000 - 500
  });

  it("computes CSP capital in use as strike × 100 × contracts", async () => {
    setupOnPortfolio({ openTrades: [makeOpenCSP("AAPL", 200, 2)] });
    const res = await GET();
    const body = await res.json() as { perPortfolio: Record<string, { capitalInUse: number }> };
    // 200 × 100 × 2 = 40,000
    expect(body.perPortfolio["port-1"].capitalInUse).toBe(40000);
  });

  it("CC contributes 0 to capitalInUse (tracked via stock lot)", async () => {
    setupOnPortfolio({ openTrades: [makeOpenCC()] });
    const res = await GET();
    const body = await res.json() as { perPortfolio: Record<string, { capitalInUseOptions: number }> };
    expect(body.perPortfolio["port-1"].capitalInUseOptions).toBe(0);
  });

  it("stock lots contribute to capitalInUseStocks", async () => {
    setupOnPortfolio({
      stockLots: [{ shares: 100, avgCost: new Prisma.Decimal("50") }],
    });
    const res = await GET();
    const body = await res.json() as { perPortfolio: Record<string, { capitalInUseStocks: number }> };
    expect(body.perPortfolio["port-1"].capitalInUseStocks).toBe(5000);
  });

  it("sums realized P&L from closed trades", async () => {
    setupOnPortfolio({ closedAll: [makeClosedTrade("AAPL", 600)] });
    const res = await GET();
    const body = await res.json() as { perPortfolio: Record<string, { totalProfitAll: number }> };
    expect(body.perPortfolio["port-1"].totalProfitAll).toBe(600);
  });

  it("computes winRate correctly", async () => {
    const trades = [makeClosedTrade("AAPL", 600), makeClosedTrade("GOOGL", -200)];
    setupOnPortfolio({ closedAll: trades });
    const res = await GET();
    const body = await res.json() as { perPortfolio: Record<string, { winRate: number | null }> };
    // 1 win out of 2 = 50%
    expect(body.perPortfolio["port-1"].winRate).toBe(50);
  });

  it("exposes realized7D in perPortfolio", async () => {
    // closed7D is derived from closed90 filtered to last 6 days — use a recent date
    const recent = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    setupOnPortfolio({ closedAll: [makeClosedTrade("AAPL", 400, recent)] });
    const res = await GET();
    const body = await res.json() as { perPortfolio: Record<string, { realized7D: number }> };
    expect(body.perPortfolio["port-1"].realized7D).toBe(400);
  });

  it("exposes winRate7D in perPortfolio", async () => {
    const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const trades = [makeClosedTrade("AAPL", 500, recent), makeClosedTrade("GOOGL", -100, recent)];
    setupOnPortfolio({ closedAll: trades });
    const res = await GET();
    const body = await res.json() as { perPortfolio: Record<string, { winRate7D: number | null }> };
    // 1 win, 1 loss among the two recent trades → 50%
    expect(body.perPortfolio["port-1"].winRate7D).toBe(50);
  });

  it("exposes winRateMTD in perPortfolio", async () => {
    setupOnPortfolio({ closedAll: [makeClosedTrade("AAPL", 300, twoWeeksAgo)] });
    const res = await GET();
    const body = await res.json() as { perPortfolio: Record<string, { winRateMTD: number | null }> };
    // twoWeeksAgo is within the current month — 1 win = 100%
    // (only true if twoWeeksAgo is in the same month as now; it is by construction)
    if (twoWeeksAgo.getMonth() === now.getMonth()) {
      expect(body.perPortfolio["port-1"].winRateMTD).toBe(100);
    } else {
      expect(body.perPortfolio["port-1"].winRateMTD).toBeNull();
    }
  });

  it("exposes winRateYTD in perPortfolio", async () => {
    setupOnPortfolio({ closedAll: [makeClosedTrade("AAPL", 300, twoWeeksAgo)] });
    const res = await GET();
    const body = await res.json() as { perPortfolio: Record<string, { winRateYTD: number | null }> };
    expect(body.perPortfolio["port-1"].winRateYTD).not.toBeUndefined();
  });

  it("exposes period win rates in totals", async () => {
    setupOnPortfolio({ closedAll: [makeClosedTrade("AAPL", 500)] });
    const res = await GET();
    const body = await res.json() as {
      totals: { winRate7D: number | null; winRateMTD: number | null; winRateYTD: number | null; realized7D: number }
    };
    expect(body.totals).toHaveProperty("winRate7D");
    expect(body.totals).toHaveProperty("winRateMTD");
    expect(body.totals).toHaveProperty("winRateYTD");
    expect(body.totals).toHaveProperty("realized7D");
    expect(typeof body.totals.realized7D).toBe("number");
  });

  it("identifies next expiration from open trades", async () => {
    setupOnPortfolio({ openTrades: [makeOpenCSP()] });
    const res = await GET();
    const body = await res.json() as { nextExpiration: { date: string; contracts: number } | null };
    expect(body.nextExpiration).not.toBeNull();
    expect(body.nextExpiration?.contracts).toBeGreaterThan(0);
  });

  it("returns null nextExpiration when no open trades", async () => {
    setupOnPortfolio({ openTrades: [] });
    const res = await GET();
    const body = await res.json() as { nextExpiration: null };
    expect(body.nextExpiration).toBeNull();
  });

  it("includes topTickers by CSP collateral", async () => {
    setupOnPortfolio({ openTrades: [makeOpenCSP("AAPL", 200, 5), makeOpenCSP("GOOGL", 100, 2)] });
    const res = await GET();
    const body = await res.json() as { topTickers: Array<{ ticker: string }> };
    expect(body.topTickers[0].ticker).toBe("AAPL"); // AAPL has higher collateral
  });

  it("returns openTrades in the response", async () => {
    setupOnPortfolio({ openTrades: [makeOpenCSP()] });
    const res = await GET();
    const body = await res.json() as { openTrades: unknown[] };
    expect(Array.isArray(body.openTrades)).toBe(true);
    expect(body.openTrades).toHaveLength(1);
  });

  it("includes P&L time series arrays", async () => {
    setupOnPortfolio({ closedAll: [makeClosedTrade("AAPL", 300, twoWeeksAgo)] });
    const res = await GET();
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body.pnlSeriesMTD)).toBe(true);
    expect(Array.isArray(body.pnlSeriesYTD)).toBe(true);
    expect(Array.isArray(body.pnlSeriesDaily90)).toBe(true);
    expect(Array.isArray(body.pnlSeriesWeekly52)).toBe(true);
    expect(Array.isArray(body.pnlSeriesMonthly12)).toBe(true);
  });
});

describe("GET /api/account/summary — multiple portfolios", () => {
  it("aggregates totals across multiple portfolios", async () => {
    mockPortfolioFindMany.mockResolvedValue([makePortfolio("port-1", 10000), makePortfolio("port-2", 5000)]);
    // Set up 2 portfolios × 6 DB calls each
    setupOnPortfolio({ openTrades: [makeOpenCSP("AAPL", 200, 2)] }); // port-1
    setupOnPortfolio({ openTrades: [makeOpenCSP("TSLA", 300, 1)] }); // port-2

    const res = await GET();
    const body = await res.json() as { totals: { capitalBase: number; portfolioCount: number } };
    expect(body.totals.portfolioCount).toBe(2);
    expect(body.totals.capitalBase).toBe(15000);
  });
});
