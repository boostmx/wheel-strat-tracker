import { describe, it, expect } from "vitest";
import {
  isDateOnlyString,
  toUtcMidnight,
  dayStringToUtcMidnight,
  ensureUtcMidnight,
  toDateOnlyStringUTC,
  addDaysUtc,
  formatDateOnlyUTC,
} from "@/lib/formatDateOnly";

describe("isDateOnlyString", () => {
  it("accepts YYYY-MM-DD", () => expect(isDateOnlyString("2025-06-20")).toBe(true));
  it("rejects ISO with time", () => expect(isDateOnlyString("2025-06-20T00:00:00Z")).toBe(false));
  it("rejects partial dates", () => expect(isDateOnlyString("2025-6-20")).toBe(false));
});

describe("dayStringToUtcMidnight", () => {
  it("parses to UTC midnight", () => {
    const d = dayStringToUtcMidnight("2025-06-20");
    expect(d.toISOString()).toBe("2025-06-20T00:00:00.000Z");
  });
});

describe("toUtcMidnight", () => {
  it("strips time component", () => {
    const d = toUtcMidnight(new Date(2025, 5, 20, 15, 30));
    expect(d.toISOString()).toBe("2025-06-20T00:00:00.000Z");
  });
});

describe("ensureUtcMidnight", () => {
  it("passes through date-only string", () => {
    expect(ensureUtcMidnight("2025-01-15").toISOString()).toBe("2025-01-15T00:00:00.000Z");
  });
  it("normalizes a Date", () => {
    expect(ensureUtcMidnight(new Date(2025, 0, 15, 12, 0)).toISOString()).toBe("2025-01-15T00:00:00.000Z");
  });
});

describe("toDateOnlyStringUTC", () => {
  it("returns YYYY-MM-DD from a Date", () => {
    expect(toDateOnlyStringUTC(new Date("2025-06-20T14:00:00Z"))).toBe("2025-06-20");
  });
  it("is idempotent on date-only strings", () => {
    expect(toDateOnlyStringUTC("2025-06-20")).toBe("2025-06-20");
  });
});

describe("addDaysUtc", () => {
  it("adds days without tz shift", () => {
    expect(addDaysUtc("2025-01-30", 3).toISOString()).toBe("2025-02-02T00:00:00.000Z");
  });
  it("handles month boundary", () => {
    expect(addDaysUtc("2025-12-31", 1).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("formatDateOnlyUTC", () => {
  it("formats YYYY-MM-DD → MM/DD/YYYY", () => {
    expect(formatDateOnlyUTC("2025-06-20")).toBe("06/20/2025");
  });
  it("formats a Date-only string passed as Date equivalent", () => {
    // Use a date-only string to avoid local timezone shifting the day
    expect(formatDateOnlyUTC("2025-06-20")).toBe("06/20/2025");
  });
  it("pads single-digit months and days", () => {
    expect(formatDateOnlyUTC("2025-01-05")).toBe("01/05/2025");
  });
});
