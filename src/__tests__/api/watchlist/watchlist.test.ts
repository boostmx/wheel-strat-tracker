import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../../helpers/mocks";

const { mockGetServerSession, mockGetEffectiveUserId, mockWatchlistFindMany, mockWatchlistCreate, mockWatchlistDeleteMany, mockPortfolioFindMany, mockTradeFindMany, mockStockLotFindMany } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetEffectiveUserId: vi.fn().mockResolvedValue("user-1"),
  mockWatchlistFindMany: vi.fn(),
  mockWatchlistCreate: vi.fn(),
  mockWatchlistDeleteMany: vi.fn(),
  mockPortfolioFindMany: vi.fn(),
  mockTradeFindMany: vi.fn(),
  mockStockLotFindMany: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/server/auth/getEffectiveUserId", () => ({ getEffectiveUserId: mockGetEffectiveUserId }));
vi.mock("@/server/prisma", () => ({
  prisma: {
    watchlistItem: {
      findMany: mockWatchlistFindMany,
      create: mockWatchlistCreate,
      deleteMany: mockWatchlistDeleteMany,
    },
    portfolio: { findMany: mockPortfolioFindMany },
    trade: { findMany: mockTradeFindMany },
    stockLot: { findMany: mockStockLotFindMany },
  },
}));

import { GET, POST } from "@/app/api/watchlist/route";
import { DELETE } from "@/app/api/watchlist/[ticker]/route";

function makePostReq(body: unknown) {
  return new Request("http://localhost/api/watchlist", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockGetEffectiveUserId.mockResolvedValue("user-1");
  mockWatchlistFindMany.mockResolvedValue([]);
  mockPortfolioFindMany.mockResolvedValue([]);
  mockTradeFindMany.mockResolvedValue([]);
  mockStockLotFindMany.mockResolvedValue([]);
  mockWatchlistCreate.mockResolvedValue({ id: "w1", ticker: "AAPL" });
  mockWatchlistDeleteMany.mockResolvedValue({ count: 1 });
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
    const res = await POST(makePostReq({ ticker: "AAPL" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing ticker", async () => {
    const res = await POST(makePostReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for ticker too long", async () => {
    const res = await POST(makePostReq({ ticker: "TOOLONGTICKER" }));
    expect(res.status).toBe(400);
  });

  it("creates watchlist item and normalizes to uppercase", async () => {
    const res = await POST(makePostReq({ ticker: "aapl" }));
    expect(res.status).toBe(201);
    const body = await res.json() as { ticker: string };
    expect(body.ticker).toBe("AAPL");
  });

  it("returns 409 when ticker already in watchlist", async () => {
    mockWatchlistCreate.mockRejectedValue(new Error("Unique constraint"));
    const res = await POST(makePostReq({ ticker: "AAPL" }));
    expect(res.status).toBe(409);
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
