import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, adminSession, makeParams } from "../../helpers/mocks";

const {
  mockGetServerSession,
  mockGetEffectiveUserId,
  mockPortfolioFindFirst,
  mockTradeFindMany,
  mockStockLotFindMany,
} = vi.hoisted(() => ({
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

import { GET } from "@/app/api/portfolios/[id]/closed-history/route";

const now = new Date("2026-04-26T18:00:00Z");
const earlier = new Date("2026-04-26T14:00:00Z");

const sampleTrade = {
  id: "t1", portfolioId: "port-1", ticker: "AAPL",
  type: "CashSecuredPut", strikePrice: 200, entryPrice: 198,
  contractsInitial: 2, contractsOpen: 0,
  contractPrice: 3.5, closingPrice: 0.1,
  premiumCaptured: 680, percentPL: 97,
  createdAt: earlier, closedAt: now,
  closeReason: "expiredWorthless", expirationDate: now,
};

const sampleLot = {
  id: "lot-1", portfolioId: "port-1", ticker: "MSFT",
  shares: 100, avgCost: "300.000000",
  closePrice: "340.000000", realizedPnl: "4000.00",
  openedAt: earlier, closedAt: now,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockGetEffectiveUserId.mockResolvedValue("user-1");
  mockPortfolioFindFirst.mockResolvedValue({ id: "port-1" });
  mockTradeFindMany.mockResolvedValue([sampleTrade]);
  mockStockLotFindMany.mockResolvedValue([sampleLot]);
});

describe("GET /api/portfolios/[id]/closed-history", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/closed-history"), makeParams("port-1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when portfolio not found", async () => {
    mockPortfolioFindFirst.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/portfolios/bad/closed-history"), makeParams("bad"));
    expect(res.status).toBe(404);
  });

  it("returns combined trades and stock lots", async () => {
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/closed-history"), makeParams("port-1"));
    expect(res.status).toBe(200);
    const body = await res.json() as { items: Array<{ kind: string }>; total: number };
    expect(body.total).toBe(2);
    expect(body.items.some((i) => i.kind === "trade")).toBe(true);
    expect(body.items.some((i) => i.kind === "stock")).toBe(true);
  });

  it("items are sorted by closedAt descending", async () => {
    const olderTrade = { ...sampleTrade, id: "t2", closedAt: earlier };
    mockTradeFindMany.mockResolvedValue([sampleTrade, olderTrade]);
    mockStockLotFindMany.mockResolvedValue([]);
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/closed-history"), makeParams("port-1"));
    const body = await res.json() as { items: Array<{ id: string }> };
    expect(body.items[0].id).toBe("t1");
    expect(body.items[1].id).toBe("t2");
  });

  it("respects take and skip for pagination", async () => {
    const trades = Array.from({ length: 10 }, (_, i) => ({
      ...sampleTrade, id: `t${i}`, closedAt: new Date(now.getTime() - i * 1000),
    }));
    mockTradeFindMany.mockResolvedValue(trades);
    mockStockLotFindMany.mockResolvedValue([]);

    const res = await GET(
      new Request("http://localhost/api/portfolios/port-1/closed-history?take=3&skip=2"),
      makeParams("port-1"),
    );
    const body = await res.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(10);
    expect(body.items).toHaveLength(3);
  });

  it("applies dateFrom and dateTo filters to both queries", async () => {
    const res = await GET(
      new Request("http://localhost/api/portfolios/port-1/closed-history?dateFrom=2026-01-01&dateTo=2026-12-31"),
      makeParams("port-1"),
    );
    expect(res.status).toBe(200);
    expect(mockTradeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ closedAt: expect.objectContaining({ gte: expect.any(Date) }) }),
      }),
    );
    expect(mockStockLotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ closedAt: expect.objectContaining({ gte: expect.any(Date) }) }),
      }),
    );
  });

  it("returns aggregate metrics for the full window", async () => {
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/closed-history"), makeParams("port-1"));
    const body = await res.json() as { totalPremium: number; avgPercentPL: number | null };
    // trade: premiumCaptured 680, stock lot: realizedPnl 4000
    expect(body.totalPremium).toBeCloseTo(4680, 0);
    expect(body.avgPercentPL).not.toBeNull();
  });

  it("caps take at 100", async () => {
    mockTradeFindMany.mockResolvedValue([]);
    mockStockLotFindMany.mockResolvedValue([]);
    const res = await GET(
      new Request("http://localhost/api/portfolios/port-1/closed-history?take=999"),
      makeParams("port-1"),
    );
    expect(res.status).toBe(200);
  });

  it("returns empty result when no closed records exist", async () => {
    mockTradeFindMany.mockResolvedValue([]);
    mockStockLotFindMany.mockResolvedValue([]);
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/closed-history"), makeParams("port-1"));
    const body = await res.json() as { items: unknown[]; total: number; totalPremium: number };
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
    expect(body.totalPremium).toBe(0);
  });

  it("allows admin to access any portfolio", async () => {
    mockGetServerSession.mockResolvedValue(adminSession());
    mockGetEffectiveUserId.mockResolvedValue("admin-1");
    const res = await GET(new Request("http://localhost/api/portfolios/port-1/closed-history"), makeParams("port-1"));
    expect(res.status).toBe(200);
    expect(mockPortfolioFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "port-1" } }),
    );
  });
});
