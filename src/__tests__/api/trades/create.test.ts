import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../../helpers/mocks";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockAuth,
  mockStockLotFindFirst,
  mockTradeCreate,
  mockTradeFindMany,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockStockLotFindFirst: vi.fn(),
  mockTradeCreate: vi.fn(),
  mockTradeFindMany: vi.fn(),
}));

vi.mock("@/server/auth/auth", () => ({
  authOptions: {},
  auth: mockAuth,
}));
vi.mock("@/server/db", () => ({
  db: {
    stockLot: { findFirst: mockStockLotFindFirst },
    trade: { create: mockTradeCreate, findMany: mockTradeFindMany },
  },
}));

import { POST, GET } from "@/app/api/trades/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(body: unknown, method = "POST") {
  return new Request("http://localhost/api/trades", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validCSPBody = {
  portfolioId: "port-1",
  ticker: "AAPL",
  strikePrice: 200,
  expirationDate: "2025-06-20",
  type: "CashSecuredPut",
  contracts: 2,
  contractPrice: 3.5,
  entryPrice: 198,
};

const validCCBody = {
  ...validCSPBody,
  type: "CoveredCall",
  strikePrice: 210,
  stockLotId: "lot-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(mockSession());
  mockTradeCreate.mockResolvedValue({ id: "trade-new", ...validCSPBody });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("auth", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeReq(validCSPBody));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("validation", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeReq({ ticker: "AAPL" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for CC without stockLotId", async () => {
    const { stockLotId: _omit, ...body } = validCCBody;
    void _omit;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when CC stock lot not found", async () => {
    mockStockLotFindFirst.mockResolvedValue(null);
    const res = await POST(makeReq(validCCBody));
    expect(res.status).toBe(400);
  });

  it("returns 400 when CC ticker does not match lot ticker", async () => {
    mockStockLotFindFirst.mockResolvedValue({ id: "lot-1", ticker: "GOOGL", shares: 400 });
    const res = await POST(makeReq(validCCBody)); // ticker is AAPL
    expect(res.status).toBe(400);
  });

  it("returns 400 when not enough shares in lot for CC contracts", async () => {
    // 2 contracts require 200 shares, lot has only 100
    mockStockLotFindFirst.mockResolvedValue({ id: "lot-1", ticker: "AAPL", shares: 100 });
    const res = await POST(makeReq(validCCBody));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

describe("success", () => {
  it("creates a CSP and returns 201", async () => {
    const res = await POST(makeReq(validCSPBody));
    expect(res.status).toBe(201);
    expect(mockTradeCreate).toHaveBeenCalledOnce();
  });

  it("creates a CC when lot is valid, links stockLotId", async () => {
    mockStockLotFindFirst.mockResolvedValue({ id: "lot-1", ticker: "AAPL", shares: 400 });
    const res = await POST(makeReq(validCCBody));
    expect(res.status).toBe(201);

    const call = mockTradeCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.stockLotId).toBe("lot-1");
  });

  it("normalizes ticker to uppercase", async () => {
    const res = await POST(makeReq({ ...validCSPBody, ticker: "aapl" }));
    expect(res.status).toBe(201);
    const call = mockTradeCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.ticker).toBe("AAPL");
  });

  it("sets contractsOpen = contracts on creation", async () => {
    await POST(makeReq(validCSPBody));
    const call = mockTradeCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.contractsOpen).toBe(2);
    expect(call.data.contractsInitial).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("GET /api/trades", () => {
  it("returns 400 when status or portfolioId is missing", async () => {
    const res = await GET(new Request("http://localhost/api/trades"));
    expect(res.status).toBe(400);
  });

  it("returns trades list for valid query params", async () => {
    mockTradeFindMany.mockResolvedValue([{ id: "t1" }]);
    const res = await GET(new Request("http://localhost/api/trades?status=open&portfolioId=port-1"));
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(1);
  });
});
