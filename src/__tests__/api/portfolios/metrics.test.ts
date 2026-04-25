import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { mockSession } from "../../helpers/mocks";

const { mockGetServerSession, mockGetEffectiveUserId, mockPortfolioFindFirst, mockTradeFindMany, mockStockLotFindMany } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetEffectiveUserId: vi.fn().mockResolvedValue("user-1"),
  mockPortfolioFindFirst: vi.fn(),
  mockTradeFindMany: vi.fn(),
  mockStockLotFindMany: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/server/auth/getEffectiveUserId", () => ({ getEffectiveUserId: mockGetEffectiveUserId }));
vi.mock("@/server/prisma", () => ({
  prisma: {
    portfolio: { findFirst: mockPortfolioFindFirst },
    trade: { findMany: mockTradeFindMany },
    stockLot: { findMany: mockStockLotFindMany },
  },
}));

import { GET } from "@/app/api/portfolios/[id]/metrics/route";

const params = { params: Promise.resolve({ id: "port-1" }) };

const basePortfolio = {
  startingCapital: new Prisma.Decimal("10000"),
  capitalTransactions: [],
};

const now = new Date();
const future = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

const openCSP = {
  id: "t1", ticker: "AAPL", type: "CashSecuredPut",
  contractsOpen: 2, strikePrice: 200, expirationDate: future,
  createdAt: past, contractPrice: 3.5,
};

const closedTrade = {
  type: "CashSecuredPut", contractsOpen: 2, contractPrice: 3.5,
  strikePrice: 200, createdAt: past, closedAt: now,
  percentPL: 80, premiumCaptured: 560,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockGetEffectiveUserId.mockResolvedValue("user-1");
  mockPortfolioFindFirst.mockResolvedValue(basePortfolio);
  mockTradeFindMany.mockResolvedValue([]);
  mockStockLotFindMany.mockResolvedValue([]);
});

describe("GET /api/portfolios/[id]/metrics", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/metrics"), params);
    expect(res.status).toBe(401);
  });

  it("returns 404 when portfolio not found", async () => {
    mockPortfolioFindFirst.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/metrics"), params);
    expect(res.status).toBe(404);
  });

  it("returns metrics with no trades (zeroed out)", async () => {
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/metrics"), params);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.capitalBase).toBe(10000);
    expect(body.openTradesCount).toBe(0);
    expect(body.winRate).toBe(0);
  });

  it("computes capitalUsed from open CSP trades", async () => {
    mockTradeFindMany
      .mockResolvedValueOnce([openCSP])  // open trades
      .mockResolvedValueOnce([]);         // closed trades
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/metrics"), params);
    const body = await res.json() as Record<string, unknown>;
    // CSP: 200 × 100 × 2 = 40,000
    expect(body.capitalUsedOptions).toBe(40000);
  });

  it("computes realized P&L from closed trades", async () => {
    mockTradeFindMany
      .mockResolvedValueOnce([])          // open
      .mockResolvedValueOnce([closedTrade]); // closed
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/metrics"), params);
    const body = await res.json() as Record<string, unknown>;
    expect(body.totalProfit).toBe(560);
    expect(body.winRate).toBeGreaterThan(0);
  });

  it("includes stock lot capital in capitalUsedStocks", async () => {
    mockTradeFindMany.mockResolvedValue([]);
    mockStockLotFindMany.mockResolvedValue([{ shares: 100, avgCost: new Prisma.Decimal("50") }]);
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/metrics"), params);
    const body = await res.json() as Record<string, unknown>;
    expect(body.capitalUsedStocks).toBe(5000);
  });

  it("includes nextExpirations list", async () => {
    mockTradeFindMany
      .mockResolvedValueOnce([openCSP])
      .mockResolvedValueOnce([]);
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/metrics?limit=5"), params);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body.nextExpirations)).toBe(true);
  });

  it("accounts for capital transactions in capitalBase", async () => {
    mockPortfolioFindFirst.mockResolvedValue({
      startingCapital: new Prisma.Decimal("10000"),
      capitalTransactions: [
        { type: "deposit", amount: new Prisma.Decimal("2000") },
        { type: "withdrawal", amount: new Prisma.Decimal("500") },
      ],
    });
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/metrics"), params);
    const body = await res.json() as Record<string, unknown>;
    expect(body.capitalBase).toBe(11500); // 10000 + 2000 - 500
  });
});
