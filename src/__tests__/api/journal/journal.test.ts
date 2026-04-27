import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { mockSession } from "../../helpers/mocks";

const {
  mockGetServerSession,
  mockGetEffectiveUserId,
  mockPortfolioFindMany,
  mockTradeFindMany,
  mockStockLotFindMany,
  mockJournalFindUnique,
  mockJournalUpsert,
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetEffectiveUserId: vi.fn().mockResolvedValue("user-1"),
  mockPortfolioFindMany: vi.fn(),
  mockTradeFindMany: vi.fn(),
  mockStockLotFindMany: vi.fn(),
  mockJournalFindUnique: vi.fn(),
  mockJournalUpsert: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/server/auth/getEffectiveUserId", () => ({ getEffectiveUserId: mockGetEffectiveUserId }));
vi.mock("@/server/prisma", () => ({
  prisma: {
    portfolio: { findMany: mockPortfolioFindMany },
    trade: { findMany: mockTradeFindMany },
    stockLot: { findMany: mockStockLotFindMany },
    journalEntry: { findUnique: mockJournalFindUnique, upsert: mockJournalUpsert },
  },
}));

import { GET, PUT } from "@/app/api/journal/[yearMonth]/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const YEAR_MONTH = "2026-04";
const params = { params: Promise.resolve({ yearMonth: YEAR_MONTH }) };
const makeUrl = (extra = "") =>
  new Request(`http://localhost/api/journal/${YEAR_MONTH}${extra}`);

const portfolio = { id: "port-1", name: "Main" };

// Closed on Apr 15 UTC — safely inside April in all timezones
const apr15 = new Date("2026-04-15T10:00:00Z");
// Closed on Apr 20 UTC
const apr20 = new Date("2026-04-20T10:00:00Z");

function makeTrade(overrides: Partial<{
  id: string; ticker: string; type: string; closedAt: Date;
  premiumCaptured: number | null; contractPrice: number; closingPrice: number | null; contracts: number;
}> = {}) {
  return {
    id: overrides.id ?? "t1",
    ticker: overrides.ticker ?? "AAPL",
    type: overrides.type ?? "CashSecuredPut",
    portfolioId: "port-1",
    contracts: overrides.contracts ?? 2,
    contractPrice: overrides.contractPrice ?? 3.5,
    closingPrice: overrides.closingPrice ?? null,
    premiumCaptured: overrides.premiumCaptured !== undefined ? overrides.premiumCaptured : 500,
    closedAt: overrides.closedAt ?? apr15,
  };
}

function makeStockLot(overrides: Partial<{
  id: string; ticker: string; realizedPnl: Prisma.Decimal | null; closedAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "lot-1",
    ticker: overrides.ticker ?? "MSFT",
    portfolioId: "port-1",
    realizedPnl: overrides.realizedPnl ?? new Prisma.Decimal("400"),
    closedAt: overrides.closedAt ?? apr15,
  };
}

function setup({
  trades = [makeTrade()],
  stockLots = [] as ReturnType<typeof makeStockLot>[],
  notes = "",
} = {}) {
  mockPortfolioFindMany.mockResolvedValue([portfolio]);
  mockTradeFindMany.mockResolvedValue(trades);
  mockStockLotFindMany.mockResolvedValue(stockLots);
  mockJournalFindUnique.mockResolvedValue(notes ? { notes } : null);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockGetEffectiveUserId.mockResolvedValue("user-1");
});

// ---------------------------------------------------------------------------
// GET — auth + validation
// ---------------------------------------------------------------------------

describe("GET /api/journal/[yearMonth] — auth & validation", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(makeUrl(), params);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid yearMonth format", async () => {
    const badParams = { params: Promise.resolve({ yearMonth: "not-a-date" }) };
    const res = await GET(new Request("http://localhost/api/journal/not-a-date"), badParams);
    expect(res.status).toBe(400);
  });

  it("returns 400 for partial yearMonth (YYYY only)", async () => {
    const badParams = { params: Promise.resolve({ yearMonth: "2026" }) };
    const res = await GET(new Request("http://localhost/api/journal/2026"), badParams);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET — empty states
// ---------------------------------------------------------------------------

describe("GET /api/journal/[yearMonth] — empty states", () => {
  it("returns zeroed response when user has no portfolios", async () => {
    mockPortfolioFindMany.mockResolvedValue([]);
    const res = await GET(makeUrl(), params);
    expect(res.status).toBe(200);
    const body = await res.json() as { notes: string; days: object; monthStats: { tradeCount: number } };
    expect(body.notes).toBe("");
    expect(body.days).toEqual({});
    expect(body.monthStats.tradeCount).toBe(0);
  });

  it("returns empty days and zeroed stats when no trades closed this month", async () => {
    setup({ trades: [], stockLots: [] });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { days: object; monthStats: { totalPnl: number; winRate: number | null } };
    expect(body.days).toEqual({});
    expect(body.monthStats.totalPnl).toBe(0);
    expect(body.monthStats.winRate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GET — day map and P&L
// ---------------------------------------------------------------------------

describe("GET /api/journal/[yearMonth] — day map", () => {
  it("groups a closed trade into the correct date bucket", async () => {
    setup({ trades: [makeTrade({ closedAt: apr15 })] });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { days: Record<string, { pnl: number; tradeCount: number }> };
    expect(body.days["2026-04-15"]).toBeDefined();
    expect(body.days["2026-04-15"].pnl).toBe(500);
    expect(body.days["2026-04-15"].tradeCount).toBe(1);
  });

  it("uses premiumCaptured directly when present", async () => {
    setup({ trades: [makeTrade({ premiumCaptured: 750 })] });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { days: Record<string, { pnl: number }> };
    expect(body.days["2026-04-15"].pnl).toBe(750);
  });

  it("falls back to contractPrice/closingPrice arithmetic when premiumCaptured is null", async () => {
    // CSP: (open - close) × 100 × contracts = (3.5 - 0.5) × 100 × 2 = 600
    setup({ trades: [makeTrade({ premiumCaptured: null, contractPrice: 3.5, closingPrice: 0.5, contracts: 2 })] });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { days: Record<string, { pnl: number }> };
    expect(body.days["2026-04-15"].pnl).toBeCloseTo(600);
  });

  it("accumulates multiple trades on the same day", async () => {
    setup({
      trades: [
        makeTrade({ id: "t1", premiumCaptured: 300, closedAt: apr15 }),
        makeTrade({ id: "t2", premiumCaptured: 200, closedAt: apr15 }),
      ],
    });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { days: Record<string, { pnl: number; tradeCount: number }> };
    expect(body.days["2026-04-15"].pnl).toBe(500);
    expect(body.days["2026-04-15"].tradeCount).toBe(2);
  });

  it("splits trades across different dates into separate buckets", async () => {
    setup({
      trades: [
        makeTrade({ id: "t1", premiumCaptured: 300, closedAt: apr15 }),
        makeTrade({ id: "t2", premiumCaptured: 200, closedAt: apr20 }),
      ],
    });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { days: Record<string, { pnl: number }> };
    expect(body.days["2026-04-15"].pnl).toBe(300);
    expect(body.days["2026-04-20"].pnl).toBe(200);
  });

  it("includes stock lot P&L in the day bucket", async () => {
    setup({
      trades: [],
      stockLots: [makeStockLot({ realizedPnl: new Prisma.Decimal("1200"), closedAt: apr15 })],
    });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { days: Record<string, { pnl: number; tradeCount: number; trades: { kind: string }[] }> };
    expect(body.days["2026-04-15"].pnl).toBe(1200);
    expect(body.days["2026-04-15"].tradeCount).toBe(1);
    expect(body.days["2026-04-15"].trades[0].kind).toBe("stock");
  });

  it("combines trades and stock lots on the same day", async () => {
    setup({
      trades: [makeTrade({ premiumCaptured: 500, closedAt: apr15 })],
      stockLots: [makeStockLot({ realizedPnl: new Prisma.Decimal("300"), closedAt: apr15 })],
    });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { days: Record<string, { pnl: number; tradeCount: number }> };
    expect(body.days["2026-04-15"].pnl).toBe(800);
    expect(body.days["2026-04-15"].tradeCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET — monthStats
// ---------------------------------------------------------------------------

describe("GET /api/journal/[yearMonth] — monthStats", () => {
  it("computes totalPnl as sum across all days", async () => {
    setup({
      trades: [
        makeTrade({ id: "t1", premiumCaptured: 400, closedAt: apr15 }),
        makeTrade({ id: "t2", premiumCaptured: 200, closedAt: apr20 }),
      ],
    });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { monthStats: { totalPnl: number } };
    expect(body.monthStats.totalPnl).toBe(600);
  });

  it("computes winRate as profitable days / total active days", async () => {
    // Apr 15 = +500 (win), Apr 20 = -100 (loss) → 1/2 = 50%
    setup({
      trades: [
        makeTrade({ id: "t1", premiumCaptured: 500, closedAt: apr15 }),
        makeTrade({ id: "t2", premiumCaptured: -100, closedAt: apr20 }),
      ],
    });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { monthStats: { winRate: number } };
    expect(body.monthStats.winRate).toBe(50);
  });

  it("returns null winRate when there are no active days", async () => {
    setup({ trades: [], stockLots: [] });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { monthStats: { winRate: number | null } };
    expect(body.monthStats.winRate).toBeNull();
  });

  it("identifies bestDay correctly", async () => {
    setup({
      trades: [
        makeTrade({ id: "t1", premiumCaptured: 500, closedAt: apr15 }),
        makeTrade({ id: "t2", premiumCaptured: 200, closedAt: apr20 }),
      ],
    });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { monthStats: { bestDay: { date: string; pnl: number } } };
    expect(body.monthStats.bestDay?.date).toBe("2026-04-15");
    expect(body.monthStats.bestDay?.pnl).toBe(500);
  });

  it("identifies worstDay correctly", async () => {
    setup({
      trades: [
        makeTrade({ id: "t1", premiumCaptured: 500, closedAt: apr15 }),
        makeTrade({ id: "t2", premiumCaptured: -150, closedAt: apr20 }),
      ],
    });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { monthStats: { worstDay: { date: string; pnl: number } } };
    expect(body.monthStats.worstDay?.date).toBe("2026-04-20");
    expect(body.monthStats.worstDay?.pnl).toBe(-150);
  });

  it("reports correct tradeCount across all days", async () => {
    setup({
      trades: [
        makeTrade({ id: "t1", closedAt: apr15 }),
        makeTrade({ id: "t2", closedAt: apr15 }),
        makeTrade({ id: "t3", closedAt: apr20 }),
      ],
    });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { monthStats: { tradeCount: number } };
    expect(body.monthStats.tradeCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// GET — notes + portfolioId filter
// ---------------------------------------------------------------------------

describe("GET /api/journal/[yearMonth] — notes and portfolio filter", () => {
  it("returns saved notes from an existing journal entry", async () => {
    setup({ notes: "Great month for CSPs" });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { notes: string };
    expect(body.notes).toBe("Great month for CSPs");
  });

  it("returns empty string when no journal entry exists yet", async () => {
    setup({ notes: "" });
    const res = await GET(makeUrl(), params);
    const body = await res.json() as { notes: string };
    expect(body.notes).toBe("");
  });

  it("passes portfolioId filter to portfolio query", async () => {
    setup();
    await GET(makeUrl("?portfolioId=port-1"), params);
    expect(mockPortfolioFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "port-1" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// PUT — auth + validation
// ---------------------------------------------------------------------------

describe("PUT /api/journal/[yearMonth] — auth & validation", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PUT(
      new Request(`http://localhost/api/journal/${YEAR_MONTH}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "test" }),
      }),
      params,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid yearMonth format", async () => {
    const badParams = { params: Promise.resolve({ yearMonth: "bad" }) };
    const res = await PUT(
      new Request("http://localhost/api/journal/bad", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "x" }),
      }),
      badParams,
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PUT — upsert
// ---------------------------------------------------------------------------

describe("PUT /api/journal/[yearMonth] — upsert notes", () => {
  beforeEach(() => {
    mockJournalUpsert.mockResolvedValue({ notes: "My notes" });
  });

  it("upserts with the correct userId and yearMonth", async () => {
    await PUT(
      new Request(`http://localhost/api/journal/${YEAR_MONTH}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "My notes" }),
      }),
      params,
    );
    expect(mockJournalUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_yearMonth: { userId: "user-1", yearMonth: YEAR_MONTH } },
        create: expect.objectContaining({ userId: "user-1", yearMonth: YEAR_MONTH, notes: "My notes" }),
        update: expect.objectContaining({ notes: "My notes" }),
      }),
    );
  });

  it("returns the saved notes in the response", async () => {
    mockJournalUpsert.mockResolvedValue({ notes: "Volatile month overall" });
    const res = await PUT(
      new Request(`http://localhost/api/journal/${YEAR_MONTH}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Volatile month overall" }),
      }),
      params,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { notes: string };
    expect(body.notes).toBe("Volatile month overall");
  });

  it("defaults notes to empty string when body omits it", async () => {
    mockJournalUpsert.mockResolvedValue({ notes: "" });
    await PUT(
      new Request(`http://localhost/api/journal/${YEAR_MONTH}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      params,
    );
    expect(mockJournalUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { notes: "" },
      }),
    );
  });
});
