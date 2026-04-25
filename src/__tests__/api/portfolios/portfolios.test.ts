import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../../helpers/mocks";

const { mockAuth, mockGetEffectiveUserId, mockPortfolioFindMany, mockPortfolioCreate, mockPortfolioFindFirst, mockPortfolioDeleteMany, mockPortfolioUpdateMany } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetEffectiveUserId: vi.fn().mockResolvedValue("user-1"),
  mockPortfolioFindMany: vi.fn(),
  mockPortfolioCreate: vi.fn(),
  mockPortfolioFindFirst: vi.fn(),
  mockPortfolioDeleteMany: vi.fn(),
  mockPortfolioUpdateMany: vi.fn(),
}));

vi.mock("@/server/auth/auth", () => ({ authOptions: {}, auth: mockAuth }));
vi.mock("@/server/auth/getEffectiveUserId", () => ({ getEffectiveUserId: mockGetEffectiveUserId }));
vi.mock("@/server/prisma", () => ({
  prisma: {
    portfolio: {
      findMany: mockPortfolioFindMany,
      create: mockPortfolioCreate,
      findFirst: mockPortfolioFindFirst,
      deleteMany: mockPortfolioDeleteMany,
      updateMany: mockPortfolioUpdateMany,
    },
  },
}));

import { GET as listPortfolios, POST as createPortfolio } from "@/app/api/portfolios/route";
import { GET as getPortfolio, DELETE as deletePortfolio, PATCH as patchPortfolio } from "@/app/api/portfolios/[id]/route";

function makeReq(body: unknown, method = "POST") {
  return new Request("http://localhost/api/portfolios", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const portfolioParams = { params: Promise.resolve({ id: "port-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(mockSession());
  mockGetEffectiveUserId.mockResolvedValue("user-1");
  mockPortfolioFindMany.mockResolvedValue([{ id: "port-1", name: "Test" }]);
  mockPortfolioCreate.mockResolvedValue({ id: "port-new" });
  mockPortfolioFindFirst.mockResolvedValue({ id: "port-1", name: "Test" });
  mockPortfolioDeleteMany.mockResolvedValue({ count: 1 });
  mockPortfolioUpdateMany.mockResolvedValue({ count: 1 });
});

// ---------------------------------------------------------------------------
// GET /api/portfolios
// ---------------------------------------------------------------------------
describe("GET /api/portfolios", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await listPortfolios();
    expect(res.status).toBe(401);
  });

  it("returns portfolio list", async () => {
    const res = await listPortfolios();
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/portfolios
// ---------------------------------------------------------------------------
describe("POST /api/portfolios", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await createPortfolio(makeReq({ name: "Test", startingCapital: 5000 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing fields", async () => {
    const res = await createPortfolio(makeReq({ name: "Test" }));
    expect(res.status).toBe(400);
  });

  it("creates a portfolio and returns 201", async () => {
    const res = await createPortfolio(makeReq({ name: "My Portfolio", startingCapital: 10000 }));
    expect(res.status).toBe(201);
    expect(mockPortfolioCreate).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// GET /api/portfolios/[id]
// ---------------------------------------------------------------------------
describe("GET /api/portfolios/[id]", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await getPortfolio(new Request("http://localhost"), portfolioParams);
    expect(res.status).toBe(401);
  });

  it("returns 404 when portfolio not found", async () => {
    mockPortfolioFindFirst.mockResolvedValue(null);
    const res = await getPortfolio(new Request("http://localhost"), portfolioParams);
    expect(res.status).toBe(404);
  });

  it("returns portfolio data", async () => {
    const res = await getPortfolio(new Request("http://localhost"), portfolioParams);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(body.id).toBe("port-1");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/portfolios/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/portfolios/[id]", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await deletePortfolio(new Request("http://localhost"), portfolioParams);
    expect(res.status).toBe(401);
  });

  it("deletes portfolio", async () => {
    const res = await deletePortfolio(new Request("http://localhost"), portfolioParams);
    expect(res.status).toBe(200);
    expect(mockPortfolioDeleteMany).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/portfolios/[id]
// ---------------------------------------------------------------------------
describe("PATCH /api/portfolios/[id]", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await patchPortfolio(makeReq({ name: "New Name" }, "PATCH"), portfolioParams);
    expect(res.status).toBe(401);
  });

  it("returns 404 when portfolio not found", async () => {
    mockPortfolioUpdateMany.mockResolvedValue({ count: 0 });
    const res = await patchPortfolio(makeReq({ name: "New" }, "PATCH"), portfolioParams);
    expect(res.status).toBe(404);
  });

  it("updates portfolio name", async () => {
    const res = await patchPortfolio(makeReq({ name: "Updated" }, "PATCH"), portfolioParams);
    expect(res.status).toBe(200);
    expect(mockPortfolioUpdateMany).toHaveBeenCalledOnce();
  });
});
