import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUserFindFirst, mockUserCreate } = vi.hoisted(() => ({
  mockUserFindFirst: vi.fn(),
  mockUserCreate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findFirst: mockUserFindFirst, create: mockUserCreate },
  },
}));

vi.mock("bcrypt", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-pw") },
  hash: vi.fn().mockResolvedValue("hashed-pw"),
}));

import { POST } from "@/app/api/auth/signup/route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  username: "johndoe",
  password: "password123",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUserFindFirst.mockResolvedValue(null);
  mockUserCreate.mockResolvedValue({ id: "user-new" });
});

describe("POST /api/auth/signup", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeReq({ firstName: "John" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when username/email already taken", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "existing" });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(400);
  });

  it("creates user and returns 201", async () => {
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
    const body = await res.json() as { userId: string };
    expect(body.userId).toBe("user-new");
    expect(mockUserCreate).toHaveBeenCalledOnce();
  });

  it("hashes password before storing", async () => {
    await POST(makeReq(validBody));
    const createCall = mockUserCreate.mock.calls[0][0] as { data: { password: string } };
    expect(createCall.data.password).toBe("hashed-pw");
  });
});
