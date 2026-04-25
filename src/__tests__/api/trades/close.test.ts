import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { makeTxMock, makeRequest, makeParams, mockSession } from "../../helpers/mocks";

// ---------------------------------------------------------------------------
// Hoisted mocks — must use vi.hoisted so they are available inside vi.mock
// ---------------------------------------------------------------------------

const {
  mockGetServerSession,
  mockPrismaTransaction,
  mockTradeFindFirst,
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockTradeFindFirst: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/formatDateOnly", () => ({ formatDateOnlyUTC: () => "01/01/2025" }));
vi.mock("@/server/prisma", () => ({
  prisma: {
    trade: { findFirst: mockTradeFindFirst },
    $transaction: mockPrismaTransaction,
  },
}));

import { PATCH } from "@/app/api/trades/[id]/close/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseCCTrade(overrides?: object) {
  return {
    id: "trade-1",
    type: "CoveredCall",
    status: "open",
    contractsOpen: 4,
    contractsInitial: 4,
    contractPrice: 2.5,
    strikePrice: 337.5,
    expirationDate: new Date("2025-06-20"),
    ticker: "GOOGL",
    portfolioId: "port-1",
    stockLotId: "lot-1",
    premiumCaptured: 0,
    notes: null,
    ...overrides,
  };
}

function baseCSPTrade(overrides?: object) {
  return {
    id: "trade-2",
    type: "CashSecuredPut",
    status: "open",
    contractsOpen: 4,
    contractsInitial: 4,
    contractPrice: 2.5,
    strikePrice: 337.5,
    expirationDate: new Date("2025-06-20"),
    ticker: "GOOGL",
    portfolioId: "port-1",
    stockLotId: null,
    premiumCaptured: 0,
    notes: null,
    ...overrides,
  };
}

function setupTx(txOverrides?: Parameters<typeof makeTxMock>[0]) {
  const tx = makeTxMock(txOverrides);
  mockPrismaTransaction.mockImplementation(async (cb: (tx: typeof tx) => Promise<unknown>) => cb(tx));
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("auth", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ closingContracts: 4, assignment: true }), makeParams("trade-1"));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// CC assignment — partial lot (THE BUG scenario: 4 contracts, 800-share lot)
// ---------------------------------------------------------------------------

describe("CC assignment — partial stock lot", () => {
  it("only reduces shares by contractsToClose×100, leaves lot OPEN", async () => {
    mockTradeFindFirst.mockResolvedValue(baseCCTrade());

    const lotUpdate = vi.fn().mockResolvedValue({});
    setupTx({
      stockLot: {
        findUnique: vi.fn().mockResolvedValue({
          shares: 800,
          avgCost: new Prisma.Decimal("300.00"),
          realizedPnl: null,
        }),
        update: lotUpdate,
      },
    });

    const res = await PATCH(makeRequest({ closingContracts: 4, assignment: true }), makeParams("trade-1"));
    expect(res.status).toBe(200);

    const lotCall = lotUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(lotCall.data.status).toBeUndefined();   // NOT closed
    expect(lotCall.data.shares).toBe(400);         // 800 - 400
  });

  it("computes P&L on assigned shares only: 400×(337.50−300)=15000", async () => {
    mockTradeFindFirst.mockResolvedValue(baseCCTrade());

    const lotUpdate = vi.fn().mockResolvedValue({});
    setupTx({
      stockLot: {
        findUnique: vi.fn().mockResolvedValue({
          shares: 800,
          avgCost: new Prisma.Decimal("300.00"),
          realizedPnl: null,
        }),
        update: lotUpdate,
      },
    });

    await PATCH(makeRequest({ closingContracts: 4, assignment: true }), makeParams("trade-1"));

    const lotCall = lotUpdate.mock.calls[0][0] as { data: { realizedPnl: Prisma.Decimal } };
    expect(Number(lotCall.data.realizedPnl)).toBeCloseTo(15000, 2);
  });

  it("accumulates on top of prior realizedPnl", async () => {
    mockTradeFindFirst.mockResolvedValue(baseCCTrade());

    const lotUpdate = vi.fn().mockResolvedValue({});
    setupTx({
      stockLot: {
        findUnique: vi.fn().mockResolvedValue({
          shares: 800,
          avgCost: new Prisma.Decimal("300.00"),
          realizedPnl: new Prisma.Decimal("500.00"),
        }),
        update: lotUpdate,
      },
    });

    await PATCH(makeRequest({ closingContracts: 4, assignment: true }), makeParams("trade-1"));

    const lotCall = lotUpdate.mock.calls[0][0] as { data: { realizedPnl: Prisma.Decimal } };
    expect(Number(lotCall.data.realizedPnl)).toBeCloseTo(15500, 2); // 15000 + 500
  });
});

// ---------------------------------------------------------------------------
// CC assignment — full lot (4 contracts, 400-share lot → closed)
// ---------------------------------------------------------------------------

describe("CC assignment — full stock lot close", () => {
  it("sets status CLOSED when remaining shares = 0", async () => {
    mockTradeFindFirst.mockResolvedValue(baseCCTrade());

    const lotUpdate = vi.fn().mockResolvedValue({});
    setupTx({
      stockLot: {
        findUnique: vi.fn().mockResolvedValue({
          shares: 400,
          avgCost: new Prisma.Decimal("300.00"),
          realizedPnl: null,
        }),
        update: lotUpdate,
      },
    });

    const res = await PATCH(makeRequest({ closingContracts: 4, assignment: true }), makeParams("trade-1"));
    expect(res.status).toBe(200);

    const lotCall = lotUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(lotCall.data.status).toBe("CLOSED");
    expect(Number(lotCall.data.realizedPnl)).toBeCloseTo(15000, 2);
  });

  it("marks CC trade closed with correct premiumCaptured (prior 200 + new 1000)", async () => {
    mockTradeFindFirst.mockResolvedValue(baseCCTrade({ premiumCaptured: 200 }));

    const tradeUpdate = vi.fn().mockResolvedValue({});
    setupTx({
      trade: { update: tradeUpdate },
      stockLot: {
        findUnique: vi.fn().mockResolvedValue({ shares: 400, avgCost: new Prisma.Decimal("300"), realizedPnl: null }),
        update: vi.fn().mockResolvedValue({}),
      },
    });

    await PATCH(makeRequest({ closingContracts: 4, assignment: true }), makeParams("trade-1"));

    const tradeCall = tradeUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(tradeCall.data.status).toBe("closed");
    expect(tradeCall.data.closeReason).toBe("assigned");
    // 2.50 × 4 × 100 = 1000 new + 200 prior = 1200
    expect(Number(tradeCall.data.premiumCaptured)).toBeCloseTo(1200, 2);
  });
});

// ---------------------------------------------------------------------------
// CSP assignment — creates stock lot
// ---------------------------------------------------------------------------

describe("CSP assignment", () => {
  it("creates a stock lot with shares=contractsToClose×100 and netBasis=strike−premium", async () => {
    mockTradeFindFirst.mockResolvedValue(baseCSPTrade());

    const lotCreate = vi.fn().mockResolvedValue({ id: "new-lot-1" });
    const tradeUpdate = vi.fn().mockResolvedValue({});
    const tx = { stockLot: { create: lotCreate }, trade: { update: tradeUpdate } };
    mockPrismaTransaction.mockImplementation(async (cb: (tx: typeof tx) => Promise<unknown>) => cb(tx));

    const res = await PATCH(makeRequest({ closingContracts: 4, assignment: true }), makeParams("trade-2"));
    expect(res.status).toBe(200);

    const createCall = lotCreate.mock.calls[0][0] as { data: { shares: number; avgCost: Prisma.Decimal } };
    expect(createCall.data.shares).toBe(400);               // 4 × 100
    expect(Number(createCall.data.avgCost)).toBeCloseTo(335, 2); // 337.50 - 2.50
  });
});

// ---------------------------------------------------------------------------
// Non-assignment: CC full close (buy-back) — avgCost reduction
// ---------------------------------------------------------------------------

describe("CC non-assignment full close", () => {
  it("reduces stock lot avgCost by realized premium", async () => {
    mockTradeFindFirst.mockResolvedValue(baseCCTrade());

    const lotUpdate = vi.fn().mockResolvedValue({});
    const tx = makeTxMock({
      trade: { update: vi.fn().mockResolvedValue({}) },
      stockLot: {
        findUnique: vi.fn().mockResolvedValue({ shares: 400, avgCost: new Prisma.Decimal("300.00") }),
        update: lotUpdate,
      },
    });
    mockPrismaTransaction.mockImplementation(async (cb: (tx: typeof tx) => Promise<unknown>) => cb(tx));

    // Buy back at $1.00 → profit = (2.50 - 1.00) × 4 × 100 = 600
    await PATCH(makeRequest({ closingContracts: 4, closingPrice: 1.0, fullClose: true }), makeParams("trade-1"));

    const lotCall = lotUpdate.mock.calls[0][0] as { data: { avgCost: Prisma.Decimal } };
    // newAvgCost = (300 × 400 - 600) / 400 = 298.50
    expect(Number(lotCall.data.avgCost)).toBeCloseTo(298.5, 2);
  });

  it("floors avgCost at 0 when premium exceeds total basis", async () => {
    mockTradeFindFirst.mockResolvedValue(baseCCTrade({ contractPrice: 5.0 }));

    const lotUpdate = vi.fn().mockResolvedValue({});
    const tx = makeTxMock({
      trade: { update: vi.fn().mockResolvedValue({}) },
      stockLot: {
        findUnique: vi.fn().mockResolvedValue({ shares: 400, avgCost: new Prisma.Decimal("0.50") }),
        update: lotUpdate,
      },
    });
    mockPrismaTransaction.mockImplementation(async (cb: (tx: typeof tx) => Promise<unknown>) => cb(tx));

    // Expired worthless: 5.00 × 4 × 100 = 2000 > 0.50 × 400 = 200 total basis
    await PATCH(
      makeRequest({ closingContracts: 4, closingPrice: 0, fullClose: true, closeReason: "expiredWorthless" }),
      makeParams("trade-1"),
    );

    const lotCall = lotUpdate.mock.calls[0][0] as { data: { avgCost: Prisma.Decimal } };
    expect(Number(lotCall.data.avgCost)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Non-assignment partial close
// ---------------------------------------------------------------------------

describe("CC non-assignment partial close", () => {
  it("decrements contractsOpen on parent and creates a closed child trade", async () => {
    mockTradeFindFirst.mockResolvedValue(baseCCTrade({ contractsOpen: 4 }));

    const parentUpdate = vi.fn().mockResolvedValue({});
    const childCreate = vi.fn().mockResolvedValue({});
    const tx = {
      trade: { update: parentUpdate, create: childCreate },
      stockLot: {
        findUnique: vi.fn().mockResolvedValue({ shares: 400, avgCost: new Prisma.Decimal("300") }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    mockPrismaTransaction.mockImplementation(async (cb: (tx: typeof tx) => Promise<unknown>) => cb(tx));

    await PATCH(makeRequest({ closingContracts: 2, closingPrice: 1.0 }), makeParams("trade-1"));

    expect(parentUpdate.mock.calls[0][0].data.contractsOpen).toBe(2); // 4 - 2
    expect(childCreate.mock.calls[0][0].data.status).toBe("closed");
    expect(childCreate.mock.calls[0][0].data.contracts).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe("validation", () => {
  it("returns 400 for zero contractsToClose", async () => {
    const res = await PATCH(makeRequest({ closingContracts: 0, closingPrice: 1.0 }), makeParams("trade-1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when trade not found", async () => {
    mockTradeFindFirst.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ closingContracts: 4, closingPrice: 1.0 }), makeParams("trade-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when contractsToClose exceeds open contracts", async () => {
    mockTradeFindFirst.mockResolvedValue(baseCCTrade({ contractsOpen: 2 }));
    const res = await PATCH(makeRequest({ closingContracts: 4, assignment: true }), makeParams("trade-1"));
    expect(res.status).toBe(400);
  });
});
