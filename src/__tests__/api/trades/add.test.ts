import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../../helpers/mocks";

const { mockGetServerSession, mockTradeFindFirst, mockTradeUpdate } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockTradeFindFirst: vi.fn(),
  mockTradeUpdate: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/server/prisma", () => ({
  prisma: {
    trade: { findFirst: mockTradeFindFirst, update: mockTradeUpdate },
  },
}));

import { PATCH } from "@/app/api/trades/[id]/add/route";

const params = { params: Promise.resolve({ id: "trade-1" }) };

function makeReq(body: unknown) {
  return new Request("http://localhost/api/trades/trade-1/add", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const baseTrade = {
  id: "trade-1", type: "CashSecuredPut", status: "open",
  contractsOpen: 2, contractsInitial: 2, contractPrice: 3.5,
  contracts: 2, notes: null, portfolio: { userId: "user-1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockTradeFindFirst.mockResolvedValue(baseTrade);
  mockTradeUpdate.mockResolvedValue({ ...baseTrade, contractsOpen: 5 });
});

describe("PATCH /api/trades/[id]/add", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PATCH(makeReq({ addedContracts: 3, addedContractPrice: 4.0 }), params);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid input (zero contracts)", async () => {
    const res = await PATCH(makeReq({ addedContracts: 0, addedContractPrice: 4.0 }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid input (zero price)", async () => {
    const res = await PATCH(makeReq({ addedContracts: 3, addedContractPrice: 0 }), params);
    expect(res.status).toBe(400);
  });

  it("returns 404 when trade not found", async () => {
    mockTradeFindFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ addedContracts: 3, addedContractPrice: 4.0 }), params);
    expect(res.status).toBe(404);
  });

  it("adds contracts and blends average price", async () => {
    const res = await PATCH(makeReq({ addedContracts: 3, addedContractPrice: 4.0 }), params);
    expect(res.status).toBe(200);

    const updateCall = mockTradeUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    // 2 + 3 = 5
    expect(updateCall.data.contractsOpen).toBe(5);
    // avg: (3.5 × 2 + 4.0 × 3) / 5 = (7 + 12) / 5 = 3.8
    expect(Number(updateCall.data.contractPrice)).toBeCloseTo(3.8, 4);
  });

  it("appends a log entry to notes", async () => {
    const res = await PATCH(makeReq({ addedContracts: 3, addedContractPrice: 4.0 }), params);
    expect(res.status).toBe(200);
    const updateCall = mockTradeUpdate.mock.calls[0][0] as { data: { notes: string } };
    expect(updateCall.data.notes).toContain("+3x @ $4.00");
  });
});
