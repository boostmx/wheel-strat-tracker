import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../../helpers/mocks";

const {
  mockGetServerSession,
  mockGetEffectiveUserId,
  mockWatchlistFindMany,
  mockWatchlistFindFirst,
  mockWatchlistCreate,
  mockWatchlistDeleteMany,
  mockWatchlistUpdateMany,
  mockPortfolioFindMany,
  mockTradeFindMany,
  mockStockLotFindMany,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetEffectiveUserId: vi.fn().mockResolvedValue("user-1"),
  mockWatchlistFindMany: vi.fn(),
  mockWatchlistFindFirst: vi.fn(),
  mockWatchlistCreate: vi.fn(),
  mockWatchlistDeleteMany: vi.fn(),
  mockWatchlistUpdateMany: vi.fn(),
  mockPortfolioFindMany: vi.fn(),
  mockTradeFindMany: vi.fn(),
  mockStockLotFindMany: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/server/auth/getEffectiveUserId", () => ({ getEffectiveUserId: mockGetEffectiveUserId }));
vi.mock("@/server/prisma", () => ({
  prisma: {
    watchlistItem: {
      findMany: mockWatchlistFindMany,
      findFirst: mockWatchlistFindFirst,
      create: mockWatchlistCreate,
      deleteMany: mockWatchlistDeleteMany,
      updateMany: mockWatchlistUpdateMany,
    },
    portfolio: { findMany: mockPortfolioFindMany },
    trade: { findMany: mockTradeFindMany },
    stockLot: { findMany: mockStockLotFindMany },
    $transaction: mockTransaction,
  },
}));

import { GET, POST, PATCH } from "@/app/api/watchlist/route";
import { DELETE } from "@/app/api/watchlist/[ticker]/route";

function makeReq(method: string, body?: unknown) {
  return new Request("http://localhost/api/watchlist", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockGetEffectiveUserId.mockResolvedValue("user-1");
  mockWatchlistFindMany.mockResolvedValue([]);
  mockWatchlistFindFirst.mockResolvedValue(null);
  mockPortfolioFindMany.mockResolvedValue([]);
  mockTradeFindMany.mockResolvedValue([]);
  mockStockLotFindMany.mockResolvedValue([]);
  mockWatchlistCreate.mockResolvedValue({ id: "w1", ticker: "AAPL" });
  mockWatchlistDeleteMany.mockResolvedValue({ count: 1 });
  mockWatchlistUpdateMany.mockResolvedValue({ count: 1 });
  mockTransaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe("GET /api/watchlist", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns watchlist with manual tickers and positions", async () => {
    mockWatchlistFindMany.mockResolvedValue([{ ticker: "AAPL" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { manual: string[]; positions: unknown[] };
    expect(body.manual).toContain("AAPL");
    expect(Array.isArray(body.positions)).toBe(true);
  });

  it("builds positions from open trades", async () => {
    mockPortfolioFindMany.mockResolvedValue([{ id: "port-1", name: "My Portfolio" }]);
    mockTradeFindMany.mockResolvedValue([{
      id: "t1", ticker: "TSLA", type: "CashSecuredPut",
      strikePrice: 200, expirationDate: new Date("2025-06-20"),
      contractsOpen: 2, contractPrice: 3.5, portfolioId: "port-1",
    }]);
    const res = await GET();
    const body = await res.json() as { positions: Array<{ ticker: string }> };
    expect(body.positions.some(p => p.ticker === "TSLA")).toBe(true);
  });
});

describe("POST /api/watchlist", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeReq("POST", { ticker: "AAPL" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing ticker", async () => {
    const res = await POST(makeReq("POST", {}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for ticker too long", async () => {
    const res = await POST(makeReq("POST", { ticker: "TOOLONGTICKER" }));
    expect(res.status).toBe(400);
  });

  it("creates watchlist item and normalizes to uppercase", async () => {
    const res = await POST(makeReq("POST", { ticker: "aapl" }));
    expect(res.status).toBe(201);
    const body = await res.json() as { ticker: string };
    expect(body.ticker).toBe("AAPL");
  });

  it("assigns order 0 when watchlist is empty", async () => {
    mockWatchlistFindFirst.mockResolvedValue(null);
    await POST(makeReq("POST", { ticker: "AAPL" }));
    expect(mockWatchlistCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 0 }) }),
    );
  });

  it("assigns order maxOrder+1 when items already exist", async () => {
    mockWatchlistFindFirst.mockResolvedValue({ order: 3 });
    await POST(makeReq("POST", { ticker: "MSFT" }));
    expect(mockWatchlistCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 4 }) }),
    );
  });

  it("returns 409 when ticker already in watchlist", async () => {
    mockWatchlistCreate.mockRejectedValue(new Error("Unique constraint"));
    const res = await POST(makeReq("POST", { ticker: "AAPL" }));
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/watchlist", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", { tickers: ["AAPL", "MSFT"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-array tickers", async () => {
    const res = await PATCH(makeReq("PATCH", { tickers: "AAPL" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-string items in tickers", async () => {
    const res = await PATCH(makeReq("PATCH", { tickers: ["AAPL", 123] }));
    expect(res.status).toBe(400);
  });

  it("bulk-updates order for each ticker", async () => {
    const res = await PATCH(makeReq("PATCH", { tickers: ["TSLA", "AAPL", "MSFT"] }));
    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockWatchlistUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ticker: "TSLA" }), data: { order: 0 } }),
    );
    expect(mockWatchlistUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ticker: "AAPL" }), data: { order: 1 } }),
    );
    expect(mockWatchlistUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ticker: "MSFT" }), data: { order: 2 } }),
    );
  });

  it("accepts empty tickers array", async () => {
    const res = await PATCH(makeReq("PATCH", { tickers: [] }));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/watchlist/[ticker]", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ ticker: "AAPL" }) });
    expect(res.status).toBe(401);
  });

  it("deletes ticker from watchlist", async () => {
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ ticker: "aapl" }) });
    expect(res.status).toBe(200);
    expect(mockWatchlistDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ticker: "AAPL" }) }),
    );
  });
});
