import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminSession, mockSession } from "../../helpers/mocks";

const { mockGetServerSession, mockUserFindUnique, mockCookieGet, mockCookieSet, mockCookieDelete } = vi.hoisted(() => {
  const mockCookieGet = vi.fn();
  const mockCookieSet = vi.fn();
  const mockCookieDelete = vi.fn();
  return {
    mockGetServerSession: vi.fn(),
    mockUserFindUnique: vi.fn(),
    mockCookieGet,
    mockCookieSet,
    mockCookieDelete,
  };
});

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet, set: mockCookieSet, delete: mockCookieDelete }),
}));
vi.mock("@/server/prisma", () => ({
  prisma: { user: { findUnique: mockUserFindUnique } },
}));

import { GET, POST, DELETE } from "@/app/api/admin/impersonate/route";

function makeReq(body: unknown, method = "POST") {
  return new Request("http://localhost/api/admin/impersonate", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieGet.mockReturnValue(undefined);
});

describe("GET /api/admin/impersonate", () => {
  it("returns null for non-admin", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("returns null when no impersonation cookie", async () => {
    mockGetServerSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue(undefined);
    const res = await GET();
    expect(await res.json()).toBeNull();
  });

  it("returns impersonated user info when cookie is set", async () => {
    mockGetServerSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue({ value: "target-user-1" });
    mockUserFindUnique.mockResolvedValue({ id: "target-user-1", username: "tuser", firstName: "T", lastName: "User" });
    const res = await GET();
    const body = await res.json() as { userId: string };
    expect(body.userId).toBe("target-user-1");
  });
});

describe("POST /api/admin/impersonate", () => {
  it("returns 403 for non-admin", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    const res = await POST(makeReq({ userId: "u2" }));
    expect(res.status).toBe(403);
  });

  it("returns 404 when target user not found", async () => {
    mockGetServerSession.mockResolvedValue(adminSession());
    mockUserFindUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ userId: "no-such-user" }));
    expect(res.status).toBe(404);
  });

  it("sets impersonation cookie and returns user info", async () => {
    mockGetServerSession.mockResolvedValue(adminSession());
    mockUserFindUnique.mockResolvedValue({ id: "u2", username: "target", firstName: "T", lastName: "U" });
    const res = await POST(makeReq({ userId: "u2" }));
    expect(res.status).toBe(200);
    expect(mockCookieSet).toHaveBeenCalledWith("wt-impersonate", "u2", expect.any(Object));
  });
});

describe("DELETE /api/admin/impersonate", () => {
  it("returns 403 for non-admin", async () => {
    mockGetServerSession.mockResolvedValue(mockSession());
    const res = await DELETE();
    expect(res.status).toBe(403);
  });

  it("clears impersonation cookie", async () => {
    mockGetServerSession.mockResolvedValue(adminSession());
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(mockCookieDelete).toHaveBeenCalledWith("wt-impersonate");
  });
});
