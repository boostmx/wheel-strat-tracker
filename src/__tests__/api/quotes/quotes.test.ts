import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../../helpers/mocks";

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/server/auth/auth", () => ({ authOptions: {} }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { GET } from "@/app/api/quotes/route";

function yahooResponse(price: number, prev: number) {
  return {
    ok: true,
    json: async () => ({
      chart: {
        result: [{
          meta: {
            regularMarketPrice: price,
            chartPreviousClose: prev,
            marketState: "REGULAR",
            regularMarketVolume: 1000000,
            regularMarketDayHigh: price + 2,
            regularMarketDayLow: price - 2,
            fiftyTwoWeekHigh: price + 50,
            fiftyTwoWeekLow: price - 50,
          },
        }],
      },
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(mockSession());
  mockFetch.mockResolvedValue(yahooResponse(150, 145));
});

describe("GET /api/quotes", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/quotes?tickers=AAPL"));
    expect(res.status).toBe(401);
  });

  it("returns empty object when no tickers provided", async () => {
    const res = await GET(new Request("http://localhost/api/quotes?tickers="));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("returns quote data for valid ticker", async () => {
    const res = await GET(new Request("http://localhost/api/quotes?tickers=AAPL"));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, { price: number; change: number }>;
    expect(body.AAPL.price).toBe(150);
    expect(body.AAPL.change).toBeCloseTo(5, 2);
  });

  it("returns null result when Yahoo fetch fails", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const res = await GET(new Request("http://localhost/api/quotes?tickers=BAD"));
    const body = await res.json() as Record<string, { price: null }>;
    expect(body.BAD.price).toBeNull();
  });

  it("returns null result on fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    const res = await GET(new Request("http://localhost/api/quotes?tickers=ERR"));
    const body = await res.json() as Record<string, { price: null }>;
    expect(body.ERR.price).toBeNull();
  });

  it("normalizes tickers to uppercase and deduplicates", async () => {
    const res = await GET(new Request("http://localhost/api/quotes?tickers=aapl,AAPL,msft"));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(expect.arrayContaining(["AAPL", "MSFT"]));
    expect(Object.keys(body)).toHaveLength(2);
  });

  // These cases are exercised by the AddTradeModal auto-fill: when a user types a ticker and
  // the market is not in regular session, or the price field is absent, the UI must handle
  // it gracefully (null price → no auto-fill, non-null price → auto-fill regardless of state).

  it("returns price during pre-market session", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 155,
              chartPreviousClose: 150,
              marketState: "PRE",
              regularMarketVolume: null,
              regularMarketDayHigh: null,
              regularMarketDayLow: null,
              fiftyTwoWeekHigh: null,
              fiftyTwoWeekLow: null,
            },
          }],
        },
      }),
    });
    const res = await GET(new Request("http://localhost/api/quotes?tickers=AAPL"));
    const body = await res.json() as Record<string, { price: number; marketState: string }>;
    expect(body.AAPL.price).toBe(155);
    expect(body.AAPL.marketState).toBe("PRE");
  });

  it("returns price during post-market session", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 148,
              chartPreviousClose: 150,
              marketState: "POST",
              regularMarketVolume: null,
              regularMarketDayHigh: null,
              regularMarketDayLow: null,
              fiftyTwoWeekHigh: null,
              fiftyTwoWeekLow: null,
            },
          }],
        },
      }),
    });
    const res = await GET(new Request("http://localhost/api/quotes?tickers=AAPL"));
    const body = await res.json() as Record<string, { price: number; marketState: string }>;
    expect(body.AAPL.price).toBe(148);
    expect(body.AAPL.marketState).toBe("POST");
  });

  it("returns null price when regularMarketPrice is absent", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            meta: {
              chartPreviousClose: 150,
              marketState: "REGULAR",
              regularMarketVolume: null,
              regularMarketDayHigh: null,
              regularMarketDayLow: null,
              fiftyTwoWeekHigh: null,
              fiftyTwoWeekLow: null,
            },
          }],
        },
      }),
    });
    const res = await GET(new Request("http://localhost/api/quotes?tickers=AAPL"));
    const body = await res.json() as Record<string, { price: null; change: null; changePct: null }>;
    expect(body.AAPL.price).toBeNull();
    expect(body.AAPL.change).toBeNull();
    expect(body.AAPL.changePct).toBeNull();
  });

  it("converts marketState 'None' to null", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 150,
              chartPreviousClose: 145,
              marketState: "None",
              regularMarketVolume: null,
              regularMarketDayHigh: null,
              regularMarketDayLow: null,
              fiftyTwoWeekHigh: null,
              fiftyTwoWeekLow: null,
            },
          }],
        },
      }),
    });
    const res = await GET(new Request("http://localhost/api/quotes?tickers=AAPL"));
    const body = await res.json() as Record<string, { price: number; marketState: null }>;
    expect(body.AAPL.price).toBe(150);
    expect(body.AAPL.marketState).toBeNull();
  });

  it("caps batch requests at 25 tickers", async () => {
    const tickers = Array.from({ length: 30 }, (_, i) => `T${i}`).join(",");
    const res = await GET(new Request(`http://localhost/api/quotes?tickers=${tickers}`));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Object.keys(body)).toHaveLength(25);
  });
});
