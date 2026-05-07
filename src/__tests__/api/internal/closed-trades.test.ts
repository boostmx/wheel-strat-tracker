import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockTradeFindMany, mockStockLotFindMany } = vi.hoisted(() => ({
  mockTradeFindMany: vi.fn(),
  mockStockLotFindMany: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    trade: { findMany: mockTradeFindMany },
    stockLot: { findMany: mockStockLotFindMany },
  },
}));

import { GET } from "@/app/api/internal/v1/closed-trades/route";

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

type ClosedTradesBody = {
  data: {
    trades: Record<string, unknown>[];
    stockLots: Record<string, unknown>[];
  };
  meta: { version: string; requestedAt: string; total: number };
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const closedTrade = {
  id: "t1",
  ticker: "AAPL",
  type: "CashSecuredPut",
  strikePrice: 180,
  expirationDate: new Date("2026-06-20"),
  contracts: 2,
  contractsInitial: 2,
  contractPrice: 3.5,
  closedAt: new Date("2026-04-15"),
  closingPrice: 0,
  premiumCaptured: 700,
  percentPL: 100,
  closeReason: "expiredWorthless",
  portfolioId: "port-1",
  createdAt: new Date(),
  portfolio: { name: "Main Portfolio" },
};

const closedLot = {
  id: "lot-1",
  ticker: "TSLA",
  shares: 100,
  avgCost: 200,
  closePrice: 250,
  realizedPnl: 5000,
  openedAt: new Date("2026-01-01"),
  closedAt: new Date("2026-04-20"),
  portfolioId: "port-1",
  portfolio: { name: "Main Portfolio" },
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INTERNAL_API_KEY = VALID_KEY;
  mockTradeFindMany.mockResolvedValue([]);
  mockStockLotFindMany.mockResolvedValue([]);
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

describe("response shape", () => {
  it("returns empty trades and stockLots arrays when no closed records", async () => {
    const res = await GET(makeReq({ userId: "user-1" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ClosedTradesBody;
    expect(body.data.trades).toHaveLength(0);
    expect(body.data.stockLots).toHaveLength(0);
  });

  it("returns closed trades and stock lots when both exist", async () => {
    mockTradeFindMany.mockResolvedValue([closedTrade]);
    mockStockLotFindMany.mockResolvedValue([closedLot]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as ClosedTradesBody;
    expect(body.data.trades).toHaveLength(1);
    expect(body.data.stockLots).toHaveLength(1);
  });

  it("flattens portfolioName on trades and removes portfolio key", async () => {
    mockTradeFindMany.mockResolvedValue([closedTrade]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as ClosedTradesBody;
    expect(body.data.trades[0].portfolioName).toBe("Main Portfolio");
    expect(body.data.trades[0].portfolio).toBeUndefined();
  });

  it("flattens portfolioName on stockLots and removes portfolio key", async () => {
    mockStockLotFindMany.mockResolvedValue([closedLot]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as ClosedTradesBody;
    expect(body.data.stockLots[0].portfolioName).toBe("Main Portfolio");
    expect(body.data.stockLots[0].portfolio).toBeUndefined();
  });

  it("serializes avgCost, closePrice, realizedPnl as plain numbers", async () => {
    mockStockLotFindMany.mockResolvedValue([
      { ...closedLot, avgCost: "200.000000", closePrice: "250.00", realizedPnl: "5000.00" },
    ]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as ClosedTradesBody;
    const lot = body.data.stockLots[0];
    expect(typeof lot.avgCost).toBe("number");
    expect(typeof lot.closePrice).toBe("number");
    expect(typeof lot.realizedPnl).toBe("number");
  });

  it("preserves null closePrice and realizedPnl as null (not 0 or undefined)", async () => {
    mockStockLotFindMany.mockResolvedValue([
      { ...closedLot, closePrice: null, realizedPnl: null },
    ]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as ClosedTradesBody;
    expect(body.data.stockLots[0].closePrice).toBeNull();
    expect(body.data.stockLots[0].realizedPnl).toBeNull();
  });
});

describe("meta.total", () => {
  it("is 0 when no records", async () => {
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as ClosedTradesBody;
    expect(body.meta.total).toBe(0);
  });

  it("equals trades.length + stockLots.length", async () => {
    mockTradeFindMany.mockResolvedValue([closedTrade, closedTrade]);
    mockStockLotFindMany.mockResolvedValue([closedLot]);
    const res = await GET(makeReq({ userId: "user-1" }));
    const body = (await res.json()) as ClosedTradesBody;
    expect(body.meta.total).toBe(3);
  });
});

describe("query filtering", () => {
  it("passes from/to date range as closedAt filter on both queries", async () => {
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

  it("omits closedAt filter when no date params provided", async () => {
    await GET(makeReq({ userId: "user-1" }));
    const tradeArgs = mockTradeFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(tradeArgs.where.closedAt).toBeUndefined();
  });

  it("applies only from date when only from is provided", async () => {
    await GET(makeReq({ userId: "user-1", from: "2026-01-01" }));
    const tradeArgs = mockTradeFindMany.mock.calls[0][0] as {
      where: { closedAt: Record<string, unknown> };
    };
    expect(tradeArgs.where.closedAt.gte).toBeInstanceOf(Date);
    expect(tradeArgs.where.closedAt.lte).toBeUndefined();
  });

  it("scopes query to a specific portfolioId when provided", async () => {
    await GET(makeReq({ userId: "user-1", portfolioId: "port-1" }));
    expect(mockTradeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          portfolio: expect.objectContaining({ id: "port-1" }),
        }),
      }),
    );
  });

  it("omits portfolio id filter when portfolioId is absent", async () => {
    await GET(makeReq({ userId: "user-1" }));
    const tradeArgs = mockTradeFindMany.mock.calls[0][0] as {
      where: { portfolio: Record<string, unknown> };
    };
    expect(tradeArgs.where.portfolio.id).toBeUndefined();
  });
});

describe("error handling", () => {
  it("returns 500 when db.trade.findMany throws", async () => {
    mockTradeFindMany.mockRejectedValue(new Error("DB connection failed"));
    const res = await GET(makeReq({ userId: "user-1" }));
    expect(res.status).toBe(500);
  });

  it("returns 500 when db.stockLot.findMany throws", async () => {
    mockStockLotFindMany.mockRejectedValue(new Error("DB connection failed"));
    const res = await GET(makeReq({ userId: "user-1" }));
    expect(res.status).toBe(500);
  });
});
