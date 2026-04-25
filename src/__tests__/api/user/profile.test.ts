import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../../helpers/mocks";

const { mockGetServerSession, mockUserFindUnique, mockUserFindFirst, mockUserUpdate } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockUserUpdate: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/server/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      findFirst: mockUserFindFirst,
      update: mockUserUpdate,
    },
  },
}));

import { GET, PATCH } from "@/app/api/user/profile/route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/user/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const baseUser = { id: "user-1", firstName: "John", lastName: "Doe", email: "j@example.com", username: "john", bio: null, avatarUrl: null, isAdmin: false };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockUserFindUnique.mockResolvedValue(baseUser);
  mockUserFindFirst.mockResolvedValue(null);
  mockUserUpdate.mockResolvedValue(baseUser);
});

describe("GET /api/user/profile", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns user profile", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(body.id).toBe("user-1");
  });
});

describe("PATCH /api/user/profile", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PATCH(makeReq({ firstName: "Jane" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no valid fields provided", async () => {
    const res = await PATCH(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 409 when email already in use by another user", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "other-user" });
    const res = await PATCH(makeReq({ email: "taken@example.com" }));
    expect(res.status).toBe(409);
  });

  it("updates firstName", async () => {
    const res = await PATCH(makeReq({ firstName: "Jane" }));
    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledOnce();
  });

  it("updates email when not taken by another user", async () => {
    mockUserFindFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ email: "new@example.com" }));
    expect(res.status).toBe(200);
  });

  it("allows updating own email", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "user-1" }); // same user
    const res = await PATCH(makeReq({ email: "j@example.com" }));
    expect(res.status).toBe(200);
  });
});
