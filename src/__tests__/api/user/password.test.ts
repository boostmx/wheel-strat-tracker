import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../../helpers/mocks";

const { mockGetServerSession, mockUserFindUnique, mockUserUpdate, mockVerifyPassword, mockHashPassword } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockVerifyPassword: vi.fn(),
  mockHashPassword: vi.fn().mockResolvedValue("new-hashed-pw"),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/server/auth/password", () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
}));
vi.mock("@/server/prisma", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
  },
}));

import { PATCH } from "@/app/api/user/password/route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/user/password", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockUserFindUnique.mockResolvedValue({ id: "user-1", password: "old-hash" });
  mockVerifyPassword.mockResolvedValue(true);
  mockUserUpdate.mockResolvedValue({ id: "user-1" });
});

describe("PATCH /api/user/password", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PATCH(makeReq({ currentPassword: "old", newPassword: "newpassword" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    const res = await PATCH(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when new password is too short", async () => {
    const res = await PATCH(makeReq({ currentPassword: "oldpass", newPassword: "short" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq({ currentPassword: "oldpass", newPassword: "newpassword123" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when current password is incorrect", async () => {
    mockVerifyPassword.mockResolvedValue(false);
    const res = await PATCH(makeReq({ currentPassword: "wrong", newPassword: "newpassword123" }));
    expect(res.status).toBe(400);
  });

  it("updates password successfully", async () => {
    const res = await PATCH(makeReq({ currentPassword: "oldpass", newPassword: "newpassword123" }));
    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledOnce();
    expect(mockHashPassword).toHaveBeenCalledWith("newpassword123");
  });
});
