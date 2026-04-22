import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export type QuoteResult = {
  ticker: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  previousClose: number | null;
  marketState: "REGULAR" | "PRE" | "POST" | "CLOSED" | string | null;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers") ?? "";
  const tickers = [...new Set(tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean))].slice(0, 25);

  if (tickers.length === 0) {
    return NextResponse.json({});
  }

  const results = await Promise.all(
    tickers.map(async (ticker): Promise<QuoteResult> => {
      try {
        const res = await fetch(
          `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d&includePrePost=true`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0",
              "Accept": "application/json",
              "Accept-Language": "en-US,en;q=0.9",
            },
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!res.ok) return { ticker, price: null, change: null, changePct: null, previousClose: null, marketState: null };
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (!meta) return { ticker, price: null, change: null, changePct: null, previousClose: null, marketState: null };

        const price: number | null = meta.regularMarketPrice ?? null;
        const prev: number | null = meta.chartPreviousClose ?? meta.previousClose ?? null;
        const change = price != null && prev != null ? price - prev : null;
        const changePct = change != null && prev ? (change / prev) * 100 : null;
        const rawMarketState: string | null = meta.marketState ?? null;
        // Yahoo returns "None" as a string when market state is unavailable
        const marketState = rawMarketState && rawMarketState !== "None" ? rawMarketState : null;
        return { ticker, price, change, changePct, previousClose: prev, marketState };
      } catch {
        return { ticker, price: null, change: null, changePct: null, previousClose: null, marketState: null };
      }
    }),
  );

  const map: Record<string, QuoteResult> = {};
  for (const r of results) map[r.ticker] = r;

  return NextResponse.json(map, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
