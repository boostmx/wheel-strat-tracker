import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { makeParams, mockSession } from "../../helpers/mocks";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetServerSession,
  mockStockLotFindFirst,
  mockStockLotUpdate,
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockStockLotFindFirst: vi.fn(),
  mockStockLotUpdate: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}));
vi.mock("@/server/prisma", () => ({
  prisma: {
    stockLot: {
      findFirst: mockStockLotFindFirst,
      update: mockStockLotUpdate,
    },
  },
}));

import { PATCH } from "@/app/api/stocks/[id]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(body: unknown) {
  return new Request("http://localhost/api/stocks/lot-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function baseLot(overrides?: object) {
  return {
    id: "lot-1",
    status: "OPEN",
    shares: 800,
    avgCost: new Prisma.Decimal("300.00"),
    realizedPnl: null,
    trades: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockStockLotUpdate.mockResolvedValue({ id: "lot-1", trades: [] });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("auth", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PATCH(makeReq({ closePrice: 344 }), makeParams("lot-1"));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("validation", () => {
  it("returns 400 for missing closePrice", async () => {
    const res = await PATCH(makeReq({}), makeParams("lot-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for zero closePrice", async () => {
    const res = await PATCH(makeReq({ closePrice: 0 }), makeParams("lot-1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when lot not found", async () => {
    mockStockLotFindFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ closePrice: 344 }), makeParams("lot-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when lot is already CLOSED", async () => {
    mockStockLotFindFirst.mockResolvedValue(baseLot({ status: "CLOSED" }));
    const res = await PATCH(makeReq({ closePrice: 344 }), makeParams("lot-1"));
    expect(res.status).toBe(400);
  });

  it("blocks selling shares covered by open CCs", async () => {
    // 800 shares, 4 open CC contracts = 400 covered → max sellable = 400
    mockStockLotFindFirst.mockResolvedValue(baseLot({
      trades: [{ contractsOpen: 4 }],
    }));
    const res = await PATCH(makeReq({ closePrice: 344, sharesToClose: 600 }), makeParams("lot-1"));
    expect(res.status).toBe(400);
  });

  it("blocks selling more shares than exist", async () => {
    mockStockLotFindFirst.mockResolvedValue(baseLot({ shares: 400 }));
    const res = await PATCH(makeReq({ closePrice: 344, sharesToClose: 500 }), makeParams("lot-1"));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Partial sell
// ---------------------------------------------------------------------------

describe("partial sell", () => {
  it("reduces shares and accumulates realizedPnl, lot stays OPEN", async () => {
    mockStockLotFindFirst.mockResolvedValue(baseLot({ shares: 800 }));

    const res = await PATCH(makeReq({ closePrice: 344, sharesToClose: 400 }), makeParams("lot-1"));
    expect(res.status).toBe(200);

    const call = mockStockLotUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.shares).toBe(400);
    expect(call.data.status).toBeUndefined();
    // (344 - 300) × 400 = 17600
    expect(Number(call.data.realizedPnl)).toBeCloseTo(17600, 2);
  });

  it("accumulates on top of prior realizedPnl", async () => {
    mockStockLotFindFirst.mockResolvedValue(baseLot({
      shares: 800,
      realizedPnl: new Prisma.Decimal("1000.00"),
    }));

    await PATCH(makeReq({ closePrice: 344, sharesToClose: 400 }), makeParams("lot-1"));

    const call = mockStockLotUpdate.mock.calls[0][0] as { data: { realizedPnl: Prisma.Decimal } };
    expect(Number(call.data.realizedPnl)).toBeCloseTo(18600, 2); // 1000 + 17600
  });
});

// ---------------------------------------------------------------------------
// Full close
// ---------------------------------------------------------------------------

describe("full close", () => {
  it("sets status CLOSED with closePrice and total realizedPnl", async () => {
    mockStockLotFindFirst.mockResolvedValue(baseLot({ shares: 400 }));

    await PATCH(makeReq({ closePrice: 344 }), makeParams("lot-1"));

    const call = mockStockLotUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.status).toBe("CLOSED");
    expect(Number(call.data.closePrice)).toBeCloseTo(344, 2);
    // (344 - 300) × 400 = 17600
    expect(Number(call.data.realizedPnl)).toBeCloseTo(17600, 2);
  });

  it("closes when sharesToClose equals all shares", async () => {
    mockStockLotFindFirst.mockResolvedValue(baseLot({ shares: 400 }));

    await PATCH(makeReq({ closePrice: 344, sharesToClose: 400 }), makeParams("lot-1"));

    const call = mockStockLotUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.status).toBe("CLOSED");
  });
});
