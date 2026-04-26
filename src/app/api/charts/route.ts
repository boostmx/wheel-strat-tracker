import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";

export const dynamic = "force-dynamic";

export type ChartData = {
  closes: number[];
  timestamps: number[];
};

export type ChartsResponse = Record<string, ChartData>;

const EMPTY: ChartData = { closes: [], timestamps: [] };

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers") ?? "";
  const tickers = [
    ...new Set(
      tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)
    ),
  ].slice(0, 25);

  if (tickers.length === 0) return NextResponse.json({});

  const results = await Promise.all(
    tickers.map(async (ticker): Promise<[string, ChartData]> => {
      try {
        const res = await fetch(
          // 5d range so we can fall back to the last trading session on
          // weekends / holidays / pre-market when today has no data yet
          `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=5m&range=5d&includePrePost=false`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0",
              "Accept": "application/json",
              "Accept-Language": "en-US,en;q=0.9",
            },
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!res.ok) return [ticker, EMPTY];

        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) return [ticker, EMPTY];

        const rawTimestamps: number[] = result.timestamp ?? [];
        const rawCloses: (number | null)[] =
          result.indicators?.quote?.[0]?.close ?? [];

        // Bucket valid points by UTC day (86400s), then pick the most
        // recent day that has enough points to draw a meaningful line.
        const dayMap = new Map<number, { closes: number[]; timestamps: number[] }>();
        for (let i = 0; i < rawTimestamps.length; i++) {
          const c = rawCloses[i];
          if (c == null || !Number.isFinite(c)) continue;
          const dayKey = Math.floor(rawTimestamps[i] / 86400);
          if (!dayMap.has(dayKey)) dayMap.set(dayKey, { closes: [], timestamps: [] });
          const bucket = dayMap.get(dayKey)!;
          bucket.closes.push(c);
          bucket.timestamps.push(rawTimestamps[i]);
        }

        const sortedDays = [...dayMap.keys()].sort((a, b) => b - a);
        let closes: number[] = [];
        let timestamps: number[] = [];
        for (const day of sortedDays) {
          const bucket = dayMap.get(day)!;
          if (bucket.closes.length >= 3) {
            closes = bucket.closes;
            timestamps = bucket.timestamps;
            break;
          }
        }

        return [ticker, { closes, timestamps }];
      } catch {
        return [ticker, EMPTY];
      }
    }),
  );

  const map: ChartsResponse = {};
  for (const [ticker, data] of results) map[ticker] = data;

  // 5-minute cache — sparklines don't need 60s freshness
  return NextResponse.json(map, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" },
  });
}
