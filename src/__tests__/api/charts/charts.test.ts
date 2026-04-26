import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../../helpers/mocks";

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { GET } from "@/app/api/charts/route";

// Build a synthetic Yahoo chart API response for a single trading session.
// dayOffset 0 = today, -1 = yesterday (in 86400s units from a fixed base).
const BASE_DAY = 1_700_000_000; // arbitrary fixed Unix day base (seconds)

function yahooChartResponse(closes: (number | null)[], dayOffset = 0) {
  const baseTs = (Math.floor(BASE_DAY / 86400) + dayOffset) * 86400;
  const timestamps = closes.map((_, i) => baseTs + i * 300); // 5-min intervals
  return {
    ok: true,
    json: async () => ({
      chart: {
        result: [{
          timestamp: timestamps,
          indicators: { quote: [{ close: closes }] },
        }],
      },
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
});

describe("GET /api/charts", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/charts?tickers=AAPL"));
    expect(res.status).toBe(401);
  });

  it("returns empty object when no tickers provided", async () => {
    const res = await GET(new Request("http://localhost/api/charts?tickers="));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("returns closes array for a ticker with intraday data", async () => {
    mockFetch.mockResolvedValue(yahooChartResponse([100, 101, 102, 103, 104]));
    const res = await GET(new Request("http://localhost/api/charts?tickers=AAPL"));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, { closes: number[] }>;
    expect(body.AAPL.closes).toEqual([100, 101, 102, 103, 104]);
  });

  it("filters out null values from closes", async () => {
    mockFetch.mockResolvedValue(yahooChartResponse([100, null, 102, null, 104]));
    const res = await GET(new Request("http://localhost/api/charts?tickers=AAPL"));
    const body = await res.json() as Record<string, { closes: number[] }>;
    expect(body.AAPL.closes).toEqual([100, 102, 104]);
  });

  it("returns empty closes on failed Yahoo fetch", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const res = await GET(new Request("http://localhost/api/charts?tickers=BAD"));
    const body = await res.json() as Record<string, { closes: number[] }>;
    expect(body.BAD.closes).toEqual([]);
  });

  it("returns empty closes on network error", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    const res = await GET(new Request("http://localhost/api/charts?tickers=ERR"));
    const body = await res.json() as Record<string, { closes: number[] }>;
    expect(body.ERR.closes).toEqual([]);
  });

  it("falls back to the previous day when today has fewer than 3 points", async () => {
    // today (day 0): only 2 valid closes — not enough
    // yesterday (day -1): full session
    const todayBase = Math.floor(BASE_DAY / 86400) * 86400;
    const yesterdayBase = todayBase - 86400;
    const timestamps = [
      todayBase,
      todayBase + 300,
      yesterdayBase,
      yesterdayBase + 300,
      yesterdayBase + 600,
      yesterdayBase + 900,
    ];
    const closes = [150, 151, 140, 141, 142, 143];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            timestamp: timestamps,
            indicators: { quote: [{ close: closes }] },
          }],
        },
      }),
    });
    const res = await GET(new Request("http://localhost/api/charts?tickers=AAPL"));
    const body = await res.json() as Record<string, { closes: number[] }>;
    // Should use yesterday's data (4 points), not today's (2 points)
    expect(body.AAPL.closes).toEqual([140, 141, 142, 143]);
  });

  it("uses today's data when it has 3 or more points", async () => {
    const todayBase = Math.floor(BASE_DAY / 86400) * 86400;
    const yesterdayBase = todayBase - 86400;
    const timestamps = [
      todayBase,
      todayBase + 300,
      todayBase + 600,
      yesterdayBase,
      yesterdayBase + 300,
    ];
    const closes = [155, 156, 157, 140, 141];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: { result: [{ timestamp: timestamps, indicators: { quote: [{ close: closes }] } }] },
      }),
    });
    const res = await GET(new Request("http://localhost/api/charts?tickers=AAPL"));
    const body = await res.json() as Record<string, { closes: number[] }>;
    expect(body.AAPL.closes).toEqual([155, 156, 157]);
  });

  it("normalizes tickers to uppercase and deduplicates", async () => {
    mockFetch.mockResolvedValue(yahooChartResponse([100, 101, 102]));
    const res = await GET(new Request("http://localhost/api/charts?tickers=aapl,AAPL,msft"));
    const body = await res.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["AAPL", "MSFT"]);
  });

  it("fetches multiple tickers in parallel", async () => {
    mockFetch.mockResolvedValue(yahooChartResponse([100, 101, 102]));
    await GET(new Request("http://localhost/api/charts?tickers=AAPL,MSFT,TSLA"));
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("sets a 5-minute Cache-Control header", async () => {
    mockFetch.mockResolvedValue(yahooChartResponse([100, 101, 102]));
    const res = await GET(new Request("http://localhost/api/charts?tickers=AAPL"));
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });
});
