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

import { GET } from "@/app/api/internal/v1/open-positions/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_KEY = "test-secret";

function makeReq(userId?: string, apiKey = VALID_KEY) {
  const url = new URL("http://localhost");
  if (userId) url.searchParams.set("userId", userId);
  return new Request(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const trade = {
  id: "t1",
  ticker: "AAPL",
  type: "CashSecuredPut",
  strikePrice: 180,
  expirationDate: new Date("2026-06-20"),
  contracts: 2,
  contractsOpen: 2,
  contractsInitial: 2,
  contractPrice: 3.5,
  entryPrice: 178,
  portfolioId: "port-1",
  stockLotId: null,
  createdAt: new Date(),
  portfolio: { name: "Main Portfolio" },
};

const stockLot = {
  id: "lot-1",
  ticker: "AAPL",
  shares: 200,
  avgCost: 175.5,
  portfolioId: "port-1",
  openedAt: new Date(),
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
    const res = await GET(makeReq("user-1", "wrong-key"));
    expect(res.status).toBe(401);
  });
});

describe("validation", () => {
  it("returns 400 when userId is missing", async () => {
    const res = await GET(makeReq(undefined));
    expect(res.status).toBe(400);
  });
});

describe("response shape", () => {
  it("returns 200 with empty arrays when user has no open positions", async () => {
    const res = await GET(makeReq("user-1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { trades: unknown[]; stockLots: unknown[] } };
    expect(body.data.trades).toHaveLength(0);
    expect(body.data.stockLots).toHaveLength(0);
  });

  it("flattens portfolio.name into portfolioName on trades", async () => {
    mockTradeFindMany.mockResolvedValue([trade]);
    const res = await GET(makeReq("user-1"));
    const body = (await res.json()) as { data: { trades: Record<string, unknown>[] } };
    expect(body.data.trades[0].portfolioName).toBe("Main Portfolio");
    expect(body.data.trades[0].portfolio).toBeUndefined();
  });

  it("flattens portfolio.name into portfolioName on stockLots", async () => {
    mockStockLotFindMany.mockResolvedValue([stockLot]);
    const res = await GET(makeReq("user-1"));
    const body = (await res.json()) as { data: { stockLots: Record<string, unknown>[] } };
    expect(body.data.stockLots[0].portfolioName).toBe("Main Portfolio");
    expect(body.data.stockLots[0].portfolio).toBeUndefined();
  });

  it("serializes avgCost Decimal as a plain number", async () => {
    mockStockLotFindMany.mockResolvedValue([
      { ...stockLot, avgCost: "175.500000" },
    ]);
    const res = await GET(makeReq("user-1"));
    const body = (await res.json()) as { data: { stockLots: { avgCost: unknown }[] } };
    expect(typeof body.data.stockLots[0].avgCost).toBe("number");
    expect(body.data.stockLots[0].avgCost).toBeCloseTo(175.5);
  });

  it("returns both trades and stock lots when both exist", async () => {
    mockTradeFindMany.mockResolvedValue([trade]);
    mockStockLotFindMany.mockResolvedValue([stockLot]);
    const res = await GET(makeReq("user-1"));
    const body = (await res.json()) as { data: { trades: unknown[]; stockLots: unknown[] } };
    expect(body.data.trades).toHaveLength(1);
    expect(body.data.stockLots).toHaveLength(1);
  });
});

describe("query construction", () => {
  it("queries for open trades scoped to the correct userId", async () => {
    await GET(makeReq("user-42"));
    expect(mockTradeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "open",
          portfolio: expect.objectContaining({ userId: "user-42" }),
        }),
      }),
    );
  });

  it("queries for OPEN stock lots scoped to the correct userId", async () => {
    await GET(makeReq("user-42"));
    expect(mockStockLotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "OPEN",
          portfolio: expect.objectContaining({ userId: "user-42" }),
        }),
      }),
    );
  });
});

describe("error handling", () => {
  it("returns 500 when db.trade.findMany throws", async () => {
    mockTradeFindMany.mockRejectedValue(new Error("DB connection failed"));
    const res = await GET(makeReq("user-1"));
    expect(res.status).toBe(500);
  });

  it("returns 500 when db.stockLot.findMany throws", async () => {
    mockStockLotFindMany.mockRejectedValue(new Error("DB connection failed"));
    const res = await GET(makeReq("user-1"));
    expect(res.status).toBe(500);
  });
});
