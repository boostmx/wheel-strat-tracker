import { vi } from "vitest";

// Silence console.error in tests unless explicitly needed
vi.spyOn(console, "error").mockImplementation(() => {});
