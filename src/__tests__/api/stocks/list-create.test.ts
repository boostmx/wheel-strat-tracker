import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../../helpers/mocks";

const { mockGetServerSession, mockGetEffectiveUserId, mockPortfolioFindFirst, mockStockLotFindMany, mockStockLotCreate } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetEffectiveUserId: vi.fn().mockResolvedValue("user-1"),
  mockPortfolioFindFirst: vi.fn(),
  mockStockLotFindMany: vi.fn(),
  mockStockLotCreate: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/server/auth/getEffectiveUserId", () => ({ getEffectiveUserId: mockGetEffectiveUserId }));
vi.mock("@/server/prisma", () => ({
  prisma: {
    portfolio: { findFirst: mockPortfolioFindFirst },
    stockLot: { findMany: mockStockLotFindMany, create: mockStockLotCreate },
  },
}));

import { GET, POST } from "@/app/api/stocks/route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/stocks", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockGetEffectiveUserId.mockResolvedValue("user-1");
  mockPortfolioFindFirst.mockResolvedValue({ id: "port-1" });
  mockStockLotFindMany.mockResolvedValue([]);
  mockStockLotCreate.mockResolvedValue({ id: "lot-new" });
});

describe("GET /api/stocks", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/stocks?portfolioId=port-1&status=open"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when portfolioId is missing", async () => {
    const res = await GET(new Request("http://localhost/api/stocks"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when portfolio not found", async () => {
    mockPortfolioFindFirst.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/stocks?portfolioId=port-1"));
    expect(res.status).toBe(404);
  });

  it("returns open stock lots", async () => {
    mockStockLotFindMany.mockResolvedValue([{ id: "lot-1" }]);
    const res = await GET(new Request("http://localhost/api/stocks?portfolioId=port-1&status=open"));
    expect(res.status).toBe(200);
    const body = await res.json() as { stockLots: unknown[] };
    expect(body.stockLots).toHaveLength(1);
  });
});

describe("POST /api/stocks", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeReq({ portfolioId: "port-1", ticker: "AAPL", shares: 100, avgCost: 150 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const res = await POST(makeReq({ portfolioId: "port-1", ticker: "AAPL" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for zero shares", async () => {
    const res = await POST(makeReq({ portfolioId: "port-1", ticker: "AAPL", shares: 0, avgCost: 150 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative avgCost", async () => {
    const res = await POST(makeReq({ portfolioId: "port-1", ticker: "AAPL", shares: 100, avgCost: -10 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when portfolio not found", async () => {
    mockPortfolioFindFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ portfolioId: "port-1", ticker: "AAPL", shares: 100, avgCost: 150 }));
    expect(res.status).toBe(404);
  });

  it("creates stock lot and normalizes ticker to uppercase", async () => {
    const res = await POST(makeReq({ portfolioId: "port-1", ticker: "aapl", shares: 100, avgCost: 150 }));
    expect(res.status).toBe(201);
    const createCall = mockStockLotCreate.mock.calls[0][0] as { data: { ticker: string } };
    expect(createCall.data.ticker).toBe("AAPL");
  });
});
