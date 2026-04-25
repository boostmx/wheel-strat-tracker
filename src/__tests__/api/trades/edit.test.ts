import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, adminSession } from "../../helpers/mocks";

const { mockGetServerSession, mockTradeFindUnique, mockTradeUpdate } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockTradeFindUnique: vi.fn(),
  mockTradeUpdate: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/server/prisma", () => ({
  prisma: {
    trade: { findUnique: mockTradeFindUnique, update: mockTradeUpdate },
  },
}));

import { GET, PATCH } from "@/app/api/trades/[id]/route";

const params = { params: Promise.resolve({ id: "trade-1" }) };

function makeReq(body: unknown) {
  return new Request("http://localhost/api/trades/trade-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const baseTrade = {
  id: "trade-1", ticker: "AAPL", type: "CashSecuredPut",
  strikePrice: 200, contractPrice: 3.5, status: "open",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockTradeFindUnique.mockResolvedValue(baseTrade);
  mockTradeUpdate.mockResolvedValue(baseTrade);
});

describe("GET /api/trades/[id]", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), params);
    expect(res.status).toBe(401);
  });

  it("returns 404 when trade not found", async () => {
    mockTradeFindUnique.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), params);
    expect(res.status).toBe(404);
  });

  it("returns trade data", async () => {
    const res = await GET(new Request("http://localhost"), params);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(body.id).toBe("trade-1");
  });
});

describe("PATCH /api/trades/[id]", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PATCH(makeReq({ notes: "test" }), params);
    expect(res.status).toBe(401);
  });

  it("returns 400 when no valid fields", async () => {
    const res = await PATCH(makeReq({}), params);
    expect(res.status).toBe(400);
  });

  it("updates notes", async () => {
    const res = await PATCH(makeReq({ notes: "updated note" }), params);
    expect(res.status).toBe(200);
    const updateCall = mockTradeUpdate.mock.calls[0][0] as { data: { notes: string } };
    expect(updateCall.data.notes).toBe("updated note");
  });

  it("updates strikePrice", async () => {
    const res = await PATCH(makeReq({ strikePrice: 210 }), params);
    expect(res.status).toBe(200);
  });

  it("admin can update ticker", async () => {
    mockGetServerSession.mockResolvedValue(adminSession());
    const res = await PATCH(makeReq({ ticker: "googl" }), params);
    expect(res.status).toBe(200);
    const updateCall = mockTradeUpdate.mock.calls[0][0] as { data: { ticker: string } };
    expect(updateCall.data.ticker).toBe("GOOGL");
  });

  it("admin can update contractsOpen and premiumCaptured", async () => {
    mockGetServerSession.mockResolvedValue(adminSession());
    const res = await PATCH(makeReq({ contractsOpen: 3, premiumCaptured: 450 }), params);
    expect(res.status).toBe(200);
    const updateCall = mockTradeUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data.contractsOpen).toBe(3);
    expect(updateCall.data.premiumCaptured).toBe(450);
  });

  it("admin can update closeReason", async () => {
    mockGetServerSession.mockResolvedValue(adminSession());
    const res = await PATCH(makeReq({ closeReason: "expiredWorthless" }), params);
    expect(res.status).toBe(200);
  });

  it("updates expirationDate from string", async () => {
    const res = await PATCH(makeReq({ expirationDate: "2025-12-19" }), params);
    expect(res.status).toBe(200);
    const updateCall = mockTradeUpdate.mock.calls[0][0] as { data: { expirationDate: Date } };
    expect(updateCall.data.expirationDate).toBeInstanceOf(Date);
  });

  it("updates type when valid TradeType", async () => {
    const res = await PATCH(makeReq({ type: "CoveredCall" }), params);
    expect(res.status).toBe(200);
  });

  it("non-admin cannot update ticker (field ignored, but notes still updates)", async () => {
    const res = await PATCH(makeReq({ notes: "note", ticker: "GOOGL" }), params);
    expect(res.status).toBe(200);
    const updateCall = mockTradeUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data.ticker).toBeUndefined();
  });
});
