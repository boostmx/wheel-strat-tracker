import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockTradeFindMany, mockStockLotFindMany, mockPortfolioFindMany } =
  vi.hoisted(() => ({
    mockTradeFindMany: vi.fn(),
    mockStockLotFindMany: vi.fn(),
    mockPortfolioFindMany: vi.fn(),
  }));

vi.mock("@/server/db", () => ({
  db: {
    trade: { findMany: mockTradeFindMany },
    stockLot: { findMany: mockStockLotFindMany },
    portfolio: { findMany: mockPortfolioFindMany },
  },
}));

import { GET } from "@/app/api/internal/v1/trading-summary/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_KEY = "test-secret";

function makeReq(params: Record<string, string> = {}, apiKey = VALID_KEY) {
  const url = new URL("http://localhost");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

type SummaryBody = {
  data: {
    tradePnl: number;
    stockPnl: number;
    totalPnl: number;
    tradeCount: number;
    winCount: number;
    winRate: number;
    byPortfolio: {
      portfolioId: string;
      portfolioName: string;
      tradePnl: number;
      stockPnl: number;
      totalPnl: number;
      tradeCount: number;
      winCount: number;
    }[];
  };
  meta: { version: string; requestedAt: string };
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const portfolios = [{ id: "port-1", name: "Main Portfolio" }];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INTERNAL_API_KEY = VALID_KEY;
  mockTradeFindMany.mockResolvedValue([]);
  mockStockLotFindMany.mockResolvedValue([]);
  mockPortfolioFindMany.mockResolvedValue(portfolios);
});

afterEach(() => {
  delete process.env.INTERNAL_API_KEY;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("authentication", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await GET(new Request("http://localhost?userId=user-1"));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong API key", async () => {
    const res = await GET(makeReq({ userId: "user-1" }, "wrong-key"));
    expect(res.status).toBe(401);
  });
});

describe("validation", () => {
  it("returns 400 when userId is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });
});

describe("aggregation — totals", () => {
  it("returns all zeros when no closed positions", async () => {
    const res = await GET(makeReq({ userId: "user-1" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as SummaryBody;
    expect(body.data.tradePnl).toBe(0);
    expect(body.data.stockPnl).toBe(0);
    expect(body.data.totalPnl).toBe(0);
    expect(body.data.tradeCount).toBe(0);
    expect(body.data.winRate).toBe(0);
    expect(body.data.byPortfolio).toHaveLength(0);
  });

  it("sums premiumCaptured across all closed trades", async () => {
    mockTradeFindMany.mockResolvedValue([
      { portfolioId: "port-1", premiumCaptured: 500 },
      { portfolioId: "port-1", premiumCaptured: 300 },
      { portfolioId: "port-1", premiumCaptured: -100 },
    ]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as SummaryBody;
    expect(body.data.tradePnl).toBe(700);
    expect(body.data.tradeCount).toBe(3);
  });

  it("sums realizedPnl from closed stock lots", async () => {
    mockStockLotFindMany.mockResolvedValue([
      { portfolioId: "port-1", realizedPnl: 400 },
      { portfolioId: "port-1", realizedPnl: 150 },
    ]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as SummaryBody;
    expect(body.data.stockPnl).toBe(550);
  });

  it("totalPnl = tradePnl + stockPnl", async () => {
    mockTradeFindMany.mockResolvedValue([
      { portfolioId: "port-1", premiumCaptured: 500 },
    ]);
    mockStockLotFindMany.mockResolvedValue([
      { portfolioId: "port-1", realizedPnl: 250 },
    ]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as SummaryBody;
    expect(body.data.totalPnl).toBe(750);
  });

  it("treats null premiumCaptured as 0", async () => {
    mockTradeFindMany.mockResolvedValue([
      { portfolioId: "port-1", premiumCaptured: null },
    ]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as SummaryBody;
    expect(body.data.tradePnl).toBe(0);
  });

  it("treats null realizedPnl as 0", async () => {
    mockStockLotFindMany.mockResolvedValue([
      { portfolioId: "port-1", realizedPnl: null },
    ]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as SummaryBody;
    expect(body.data.stockPnl).toBe(0);
  });
});

describe("aggregation — win rate", () => {
  it("counts trades with premiumCaptured > 0 as wins", async () => {
    mockTradeFindMany.mockResolvedValue([
      { portfolioId: "port-1", premiumCaptured: 400 },
      { portfolioId: "port-1", premiumCaptured: 200 },
      { portfolioId: "port-1", premiumCaptured: -50 },
    ]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as SummaryBody;
    expect(body.data.winCount).toBe(2);
    expect(body.data.winRate).toBeCloseTo(2 / 3);
  });

  it("winRate is 0 when tradeCount is 0 (no division by zero)", async () => {
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as SummaryBody;
    expect(body.data.winRate).toBe(0);
  });

  it("winRate is 1 when all trades are wins", async () => {
    mockTradeFindMany.mockResolvedValue([
      { portfolioId: "port-1", premiumCaptured: 300 },
      { portfolioId: "port-1", premiumCaptured: 100 },
    ]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as SummaryBody;
    expect(body.data.winRate).toBe(1);
  });
});

describe("byPortfolio breakdown", () => {
  it("groups trades and lots by portfolio", async () => {
    mockPortfolioFindMany.mockResolvedValue([
      { id: "port-1", name: "Main Portfolio" },
      { id: "port-2", name: "Options Account" },
    ]);
    mockTradeFindMany.mockResolvedValue([
      { portfolioId: "port-1", premiumCaptured: 500 },
      { portfolioId: "port-2", premiumCaptured: 300 },
    ]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as SummaryBody;
    expect(body.data.byPortfolio).toHaveLength(2);
    const p1 = body.data.byPortfolio.find((p) => p.portfolioId === "port-1")!;
    const p2 = body.data.byPortfolio.find((p) => p.portfolioId === "port-2")!;
    expect(p1.tradePnl).toBe(500);
    expect(p2.tradePnl).toBe(300);
  });

  it("resolves portfolioName from portfolio list", async () => {
    mockTradeFindMany.mockResolvedValue([
      { portfolioId: "port-1", premiumCaptured: 100 },
    ]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as SummaryBody;
    expect(body.data.byPortfolio[0].portfolioName).toBe("Main Portfolio");
  });

  it("computes totalPnl = tradePnl + stockPnl per portfolio", async () => {
    mockTradeFindMany.mockResolvedValue([
      { portfolioId: "port-1", premiumCaptured: 600 },
    ]);
    mockStockLotFindMany.mockResolvedValue([
      { portfolioId: "port-1", realizedPnl: 200 },
    ]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as SummaryBody;
    expect(body.data.byPortfolio[0].totalPnl).toBe(800);
  });
});

describe("query filtering", () => {
  it("passes from/to date range as closedAt filter", async () => {
    await GET(makeReq({ userId: "user-1", from: "2026-01-01", to: "2026-12-31" }));
    expect(mockTradeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          closedAt: { gte: expect.any(Date), lte: expect.any(Date) },
        }),
      }),
    );
    expect(mockStockLotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          closedAt: { gte: expect.any(Date), lte: expect.any(Date) },
        }),
      }),
    );
  });

  it("omits closedAt filter entirely when no date params provided", async () => {
    await GET(makeReq({ userId: "user-1" }));
    const tradeArgs = mockTradeFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(tradeArgs.where.closedAt).toBeUndefined();
  });

  it("passes portfolioIds as { id: { in: [...] } } filter", async () => {
    await GET(makeReq({ userId: "user-1", portfolioIds: "port-1,port-2" }));
    expect(mockTradeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          portfolio: expect.objectContaining({
            id: { in: ["port-1", "port-2"] },
          }),
        }),
      }),
    );
  });

  it("omits portfolioId filter when portfolioIds param is absent", async () => {
    await GET(makeReq({ userId: "user-1" }));
    const tradeArgs = mockTradeFindMany.mock.calls[0][0] as {
      where: { portfolio: Record<string, unknown> };
    };
    expect(tradeArgs.where.portfolio.id).toBeUndefined();
  });
});

describe("error handling", () => {
  it("returns 500 when db throws", async () => {
    mockTradeFindMany.mockRejectedValue(new Error("DB connection failed"));
    const res = await GET(makeReq({ userId: "user-1" }));
    expect(res.status).toBe(500);
  });
});
