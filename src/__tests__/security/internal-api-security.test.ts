/**
 * Security tests for the internal API key authentication layer.
 *
 * Internal endpoints are machine-to-machine only — they use a shared
 * INTERNAL_API_KEY env var, NOT NextAuth sessions. These tests verify:
 *   1. Every endpoint rejects requests without a valid Bearer token.
 *   2. No auth format bypass (wrong scheme, empty token, missing env var).
 *   3. A valid key grants access across all three endpoints.
 *   4. userId is required on every endpoint (separate from auth).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — DB must be mocked before route imports
// ---------------------------------------------------------------------------

const { mockTradeFindMany, mockStockLotFindMany, mockPortfolioFindMany } =
  vi.hoisted(() => ({
    mockTradeFindMany: vi.fn(),
    mockStockLotFindMany: vi.fn(),
    mockPortfolioFindMany: vi.fn(),
  }));

vi.mock("@/server/db", () => ({
  db: {
    trade: { findMany: mockTradeFindMany },
    stockLot: { findMany: mockStockLotFindMany },
    portfolio: { findMany: mockPortfolioFindMany },
  },
}));

// Route imports — after mocks
import { GET as getOpenPositions } from "@/app/api/internal/v1/open-positions/route";
import { GET as getTradingSummary } from "@/app/api/internal/v1/trading-summary/route";
import { GET as getClosedTrades } from "@/app/api/internal/v1/closed-trades/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_KEY = "test-internal-secret";
const BASE_URL = "http://localhost";

function req(userId: string, authHeader?: string) {
  const url = `${BASE_URL}?userId=${userId}`;
  return new Request(url, {
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}

const endpoints = [
  { name: "open-positions", handler: getOpenPositions },
  { name: "trading-summary", handler: getTradingSummary },
  { name: "closed-trades", handler: getClosedTrades },
] as const;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INTERNAL_API_KEY = VALID_KEY;
  mockTradeFindMany.mockResolvedValue([]);
  mockStockLotFindMany.mockResolvedValue([]);
  mockPortfolioFindMany.mockResolvedValue([]);
});

afterEach(() => {
  delete process.env.INTERNAL_API_KEY;
});

// ============================================================================
// 1. Missing or malformed Authorization header
// ============================================================================

describe("Missing / malformed Authorization header — all endpoints return 401", () => {
  for (const { name, handler } of endpoints) {
    it(`${name} — no Authorization header`, async () => {
      const res = await handler(req("user-1"));
      expect(res.status).toBe(401);
    });

    it(`${name} — Bearer with wrong key`, async () => {
      const res = await handler(req("user-1", "Bearer wrong-secret"));
      expect(res.status).toBe(401);
    });

    it(`${name} — Bearer with empty token`, async () => {
      const res = await handler(req("user-1", "Bearer "));
      expect(res.status).toBe(401);
    });

    it(`${name} — Basic auth scheme (not Bearer)`, async () => {
      const res = await handler(req("user-1", "Basic dXNlcjpwYXNz"));
      expect(res.status).toBe(401);
    });

    it(`${name} — raw key with no scheme`, async () => {
      const res = await handler(req("user-1", VALID_KEY));
      expect(res.status).toBe(401);
    });
  }
});

// ============================================================================
// 2. Missing or empty INTERNAL_API_KEY env var
// ============================================================================

describe("INTERNAL_API_KEY env var missing or empty — all endpoints return 401", () => {
  for (const { name, handler } of endpoints) {
    it(`${name} — env var not set`, async () => {
      delete process.env.INTERNAL_API_KEY;
      const res = await handler(req("user-1", `Bearer ${VALID_KEY}`));
      expect(res.status).toBe(401);
    });

    it(`${name} — env var is empty string`, async () => {
      process.env.INTERNAL_API_KEY = "";
      const res = await handler(req("user-1", `Bearer ${VALID_KEY}`));
      expect(res.status).toBe(401);
    });
  }
});

// ============================================================================
// 3. Valid key — request passes auth gate
// ============================================================================

describe("Valid API key — request reaches handler (200)", () => {
  for (const { name, handler } of endpoints) {
    it(`${name} — valid Bearer key returns 200`, async () => {
      const res = await handler(req("user-1", `Bearer ${VALID_KEY}`));
      expect(res.status).toBe(200);
    });
  }
});

// ============================================================================
// 4. userId is required regardless of auth
// ============================================================================

describe("userId required — valid key but no userId returns 400", () => {
  for (const { name, handler } of endpoints) {
    it(`${name} — missing userId returns 400`, async () => {
      const res = await handler(
        new Request(BASE_URL, {
          headers: { Authorization: `Bearer ${VALID_KEY}` },
        }),
      );
      expect(res.status).toBe(400);
    });
  }
});

// ============================================================================
// 5. Response envelope — all endpoints return { data, meta } shape
// ============================================================================

describe("Response envelope — all endpoints return { data, meta: { version, requestedAt } }", () => {
  for (const { name, handler } of endpoints) {
    it(`${name} — response includes meta.version = "v1"`, async () => {
      const res = await handler(req("user-1", `Bearer ${VALID_KEY}`));
      const body = (await res.json()) as { meta: { version: string; requestedAt: string } };
      expect(body.meta.version).toBe("v1");
      expect(body.meta.requestedAt).toBeDefined();
    });
  }
});
