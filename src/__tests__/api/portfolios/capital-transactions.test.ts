import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../../helpers/mocks";

const { mockAuth, mockGetEffectiveUserId, mockPortfolioFindFirst, mockCapitalTxFindMany, mockCapitalTxCreate, mockCapitalTxDeleteMany } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetEffectiveUserId: vi.fn().mockResolvedValue("user-1"),
  mockPortfolioFindFirst: vi.fn(),
  mockCapitalTxFindMany: vi.fn(),
  mockCapitalTxCreate: vi.fn(),
  mockCapitalTxDeleteMany: vi.fn(),
}));

vi.mock("@/server/auth/auth", () => ({ authOptions: {}, auth: mockAuth }));
vi.mock("@/server/auth/getEffectiveUserId", () => ({ getEffectiveUserId: mockGetEffectiveUserId }));
vi.mock("@/server/prisma", () => ({
  prisma: {
    portfolio: { findFirst: mockPortfolioFindFirst },
    capitalTransaction: {
      findMany: mockCapitalTxFindMany,
      create: mockCapitalTxCreate,
      deleteMany: mockCapitalTxDeleteMany,
    },
  },
}));

import { GET, POST, DELETE } from "@/app/api/portfolios/[id]/capital-transactions/route";

const params = { params: Promise.resolve({ id: "port-1" }) };

function makeReq(body: unknown, method = "POST") {
  return new Request("http://localhost/api/portfolios/port-1/capital-transactions", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(mockSession());
  mockGetEffectiveUserId.mockResolvedValue("user-1");
  mockPortfolioFindFirst.mockResolvedValue({ id: "port-1" });
  mockCapitalTxFindMany.mockResolvedValue([]);
  mockCapitalTxCreate.mockResolvedValue({ id: "tx-1" });
  mockCapitalTxDeleteMany.mockResolvedValue({ count: 1 });
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
describe("GET /api/portfolios/[id]/capital-transactions", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), params);
    expect(res.status).toBe(401);
  });

  it("returns 404 when portfolio not found", async () => {
    mockPortfolioFindFirst.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), params);
    expect(res.status).toBe(404);
  });

  it("returns transactions list", async () => {
    mockCapitalTxFindMany.mockResolvedValue([{ id: "tx-1", type: "deposit", amount: "1000" }]);
    const res = await GET(new Request("http://localhost"), params);
    expect(res.status).toBe(200);
    const body = await res.json() as { transactions: unknown[] };
    expect(body.transactions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
describe("POST /api/portfolios/[id]/capital-transactions", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeReq({ type: "deposit", amount: 1000 }), params);
    expect(res.status).toBe(401);
  });

  it("returns 404 when portfolio not found", async () => {
    mockPortfolioFindFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ type: "deposit", amount: 1000 }), params);
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid type", async () => {
    const res = await POST(makeReq({ type: "invalid", amount: 1000 }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-positive amount", async () => {
    const res = await POST(makeReq({ type: "deposit", amount: -100 }), params);
    expect(res.status).toBe(400);
  });

  it("creates a deposit transaction", async () => {
    const res = await POST(makeReq({ type: "deposit", amount: 1000 }), params);
    expect(res.status).toBe(201);
    expect(mockCapitalTxCreate).toHaveBeenCalledOnce();
  });

  it("creates a withdrawal transaction", async () => {
    const res = await POST(makeReq({ type: "withdrawal", amount: 500 }), params);
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe("DELETE /api/portfolios/[id]/capital-transactions", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(makeReq({ transactionId: "tx-1" }, "DELETE"), params);
    expect(res.status).toBe(401);
  });

  it("returns 400 when transactionId is missing", async () => {
    const res = await DELETE(makeReq({}, "DELETE"), params);
    expect(res.status).toBe(400);
  });

  it("returns 404 when transaction not found", async () => {
    mockCapitalTxDeleteMany.mockResolvedValue({ count: 0 });
    const res = await DELETE(makeReq({ transactionId: "no-such" }, "DELETE"), params);
    expect(res.status).toBe(404);
  });

  it("deletes transaction", async () => {
    const res = await DELETE(makeReq({ transactionId: "tx-1" }, "DELETE"), params);
    expect(res.status).toBe(200);
    expect(mockCapitalTxDeleteMany).toHaveBeenCalledOnce();
  });
});
