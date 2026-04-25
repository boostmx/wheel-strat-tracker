import { vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export const mockSession = (overrides?: Partial<{
  id: string; isAdmin: boolean;
}>) => ({
  user: {
    id: overrides?.id ?? "user-1",
    username: "testuser",
    firstName: "Test",
    lastName: "User",
    email: "test@test.com",
    isAdmin: overrides?.isAdmin ?? false,
  },
  expires: "9999-01-01",
});

export const adminSession = () => mockSession({ id: "admin-1", isAdmin: true });

// ---------------------------------------------------------------------------
// Prisma transaction mock
// Accepts a factory so each test can inject its own tx mock
// ---------------------------------------------------------------------------

export function makeTxMock(overrides?: {
  trade?: Partial<{ update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }>;
  stockLot?: Partial<{ findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }>;
}) {
  return {
    trade: {
      update: overrides?.trade?.update ?? vi.fn().mockResolvedValue({}),
      create: overrides?.trade?.create ?? vi.fn().mockResolvedValue({}),
    },
    stockLot: {
      findUnique: overrides?.stockLot?.findUnique ?? vi.fn().mockResolvedValue(null),
      update: overrides?.stockLot?.update ?? vi.fn().mockResolvedValue({}),
    },
  };
}

// ---------------------------------------------------------------------------
// NextRequest builder
// ---------------------------------------------------------------------------

export function makeRequest(body: unknown, method = "PATCH"): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}
