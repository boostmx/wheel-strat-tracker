// src/lib/dateOnly.ts
// Utilities for handling "date-only" values safely (no time zone surprises).
// Use these for fields like expirationDate, closedAt (date-only semantics).

/** Returns true if the input is an ISO date-only string: 'YYYY-MM-DD'. */
export function isDateOnlyString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Convert a JS Date to UTC midnight for that calendar day. */
export function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Convert a 'YYYY-MM-DD' string to a Date at UTC midnight. */
export function dayStringToUtcMidnight(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Idempotently ensure a value is a Date at UTC midnight (safe for Date or 'YYYY-MM-DD'). */
export function ensureUtcMidnight(input: Date | string): Date {
  if (typeof input === "string") {
    return isDateOnlyString(input) ? dayStringToUtcMidnight(input) : toUtcMidnight(new Date(input));
  }
  return toUtcMidnight(input);
}

/** Return a 'YYYY-MM-DD' date-only string in UTC for API responses / storage. */
export function toDateOnlyStringUTC(input: Date | string): string {
  const d = ensureUtcMidnight(input);
  return d.toISOString().slice(0, 10);
}

/** Add N days in UTC (date arithmetic unaffected by local time zone). */
export function addDaysUtc(input: Date | string, days: number): Date {
  const d = ensureUtcMidnight(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

// ------------------------- Formatting (UI) -------------------------

/**
 * Format a date-only value as 'MM/DD/YYYY' using UTC semantics.
 * Accepts a Date or 'YYYY-MM-DD'. Safe against tz shifts.
 */
export function formatDateOnlyUTC(input: string | Date): string {
  // Fast-path date-only strings without extra parsing.
  if (typeof input === "string" && isDateOnlyString(input)) {
    const [yyyy, mm, dd] = input.split("-");
    return `${mm}/${dd}/${yyyy}`;
  }
  // Fallback via UTC normalization + ISO slice.
  const ymd = toDateOnlyStringUTC(input);
  const [yyyy, mm, dd] = ymd.split("-");
  return `${mm}/${dd}/${yyyy}`;
}