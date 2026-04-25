import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("hashPassword / verifyPassword", () => {
  it("hashes a password and verifies it correctly", async () => {
    const hash = await hashPassword("secret123");
    expect(typeof hash).toBe("string");
    expect(hash).not.toBe("secret123");
    await expect(verifyPassword("secret123", hash)).resolves.toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("secret123");
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("returns false when hash is null", async () => {
    await expect(verifyPassword("any", null)).resolves.toBe(false);
  });

  it("returns false when hash is undefined", async () => {
    await expect(verifyPassword("any", undefined)).resolves.toBe(false);
  });
});
