import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../../helpers/mocks";
import { NextRequest } from "next/server";

const { mockAuth, mockGetEffectiveUserId, mockPortfolioFindMany, mockPortfolioFindFirst, mockStockLotFindMany, mockGetClosedTradesInRange } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetEffectiveUserId: vi.fn().mockResolvedValue("user-1"),
  mockPortfolioFindMany: vi.fn(),
  mockPortfolioFindFirst: vi.fn(),
  mockStockLotFindMany: vi.fn(),
  mockGetClosedTradesInRange: vi.fn(),
}));

vi.mock("@/server/auth/auth", () => ({ authOptions: {}, auth: mockAuth }));
vi.mock("@/server/auth/getEffectiveUserId", () => ({ getEffectiveUserId: mockGetEffectiveUserId }));
vi.mock("@/features/reports/hooks/getClosedTradesRange", () => ({
  getClosedTradesInRange: mockGetClosedTradesInRange,
}));
vi.mock("@/server/db", () => ({
  prisma: {
    portfolio: {
      findMany: mockPortfolioFindMany,
      findFirst: mockPortfolioFindFirst,
    },
    stockLot: { findMany: mockStockLotFindMany },
  },
  db: {
    portfolio: {
      findMany: mockPortfolioFindMany,
      findFirst: mockPortfolioFindFirst,
    },
    stockLot: { findMany: mockStockLotFindMany },
  },
}));

import { GET } from "@/app/api/reports/closed/route";

const now = new Date();
const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

const sampleTrade = {
  id: "t1", portfolioId: "port-1", ticker: "AAPL",
  type: "CashSecuredPut", strikePrice: 200, entryPrice: 198,
  expirationDate: now.toISOString(),
  contracts: 2, contractsInitial: 2, contractsOpen: 0,
  contractPrice: 3.5, closingPrice: 0.5,
  createdAt: thirtyDaysAgo.toISOString(),
  closedAt: now.toISOString(),
  premiumCaptured: 600,
  percentPL: 85.71,
  notes: null, status: "closed", closeReason: "expiredWorthless",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(mockSession());
  mockGetEffectiveUserId.mockResolvedValue("user-1");
  mockPortfolioFindMany.mockResolvedValue([{ id: "port-1", name: "My Portfolio" }]);
  mockPortfolioFindFirst.mockResolvedValue({ name: "My Portfolio" });
  mockGetClosedTradesInRange.mockResolvedValue([sampleTrade]);
  mockStockLotFindMany.mockResolvedValue([]);
});

function makeReq(params = "") {
  return new NextRequest(`http://localhost/api/reports/closed${params}`);
}

describe("GET /api/reports/closed", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns JSON report with enriched rows", async () => {
    const res = await GET(makeReq("?portfolioId=port-1"));
    expect(res.status).toBe(200);
    const body = await res.json() as { rows: unknown[]; count: number };
    expect(body.count).toBeGreaterThan(0);
    expect(body.rows).toHaveLength(body.count);
  });

  it("includes date range in response", async () => {
    const res = await GET(makeReq("?portfolioId=port-1"));
    const body = await res.json() as { range: { start: string; end: string } };
    expect(body.range.start).toBeDefined();
    expect(body.range.end).toBeDefined();
  });

  it("queries all portfolios when portfolioId=all", async () => {
    const res = await GET(makeReq("?portfolioId=all"));
    expect(res.status).toBe(200);
    expect(mockPortfolioFindMany).toHaveBeenCalledOnce();
  });

  it("returns CSV format when format=csv", async () => {
    const res = await GET(makeReq("?portfolioId=port-1&format=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("Portfolio");
    expect(text).toContain("Ticker");
  });

  it("enriches rows with holdingDays and premiumReceived", async () => {
    const res = await GET(makeReq("?portfolioId=port-1"));
    const body = await res.json() as { rows: Array<Record<string, unknown>> };
    const row = body.rows[0];
    expect(typeof row.holdingDays).toBe("number");
    expect(typeof row.premiumReceived).toBe("number");
    expect(row.totalPL).toBe(600);
  });

  it("includes closed stock lots in results", async () => {
    mockGetClosedTradesInRange.mockResolvedValue([]);
    mockStockLotFindMany.mockResolvedValue([{
      id: "lot-1", portfolioId: "port-1", ticker: "GOOGL",
      openedAt: thirtyDaysAgo, closedAt: now, shares: 100,
      avgCost: "300.00", closePrice: "344.00", realizedPnl: "4400.00", notes: null,
    }]);
    const res = await GET(makeReq("?portfolioId=port-1"));
    const body = await res.json() as { rows: Array<Record<string, unknown>> };
    expect(body.rows.some(r => r.ticker === "GOOGL")).toBe(true);
  });

  it("uses custom date range from query params", async () => {
    const res = await GET(makeReq("?portfolioId=port-1&start=2025-01-01&end=2025-12-31"));
    expect(res.status).toBe(200);
  });
});
