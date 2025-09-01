import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// -------------------------
// Helpers
// -------------------------
const DAY_MS = 86_400_000;
const isCSP = (type: string | null | undefined) =>
  (type ?? "") === "CashSecuredPut";
const collateralFor = (strike: number, contracts: number) =>
  Number(strike) * 100 * Number(contracts);

const startOfMonthUTC = () => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const startOfYearUTC = () => {
  const d = new Date();
  d.setUTCMonth(0, 1);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const startOfNDaysAgoUTC = (n: number) => {
  const d = ensureUtcMidnight(new Date());
  return new Date(d.getTime() - n * DAY_MS); // inclusive window
};

// Format helpers (UTC)
const toIsoDayUTC = (d: Date) => {
  const dt = ensureUtcMidnight(d);
  return dt.toISOString().slice(0, 10); // YYYY-MM-DD
};

const toIsoMonthUTC = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; // YYYY-MM

// UTC-safe day math (avoid TZ off-by-one)
const ensureUtcMidnight = (d: Date | string) => {
  const dt = new Date(d);
  return new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()),
  );
};

// Prefer stored premiumCaptured; otherwise estimate from contractPrice vs closingPrice.
const realizedFor = (row: {
  contracts: number;
  contractPrice: number;
  closingPrice: number | null;
  premiumCaptured: number | null;
}) => {
  if (row.premiumCaptured != null) return Number(row.premiumCaptured);
  const close = row.closingPrice ?? 0;
  return (
    (Number(row.contractPrice) - Number(close)) * 100 * Number(row.contracts)
  );
};

const sumRealized = (
  rows: Array<{
    contracts: number;
    contractPrice: number;
    closingPrice: number | null;
    premiumCaptured: number | null;
  }>,
) => rows.reduce((acc, r) => acc + realizedFor(r), 0);

// -------------------------
// GET /api/account/summary
// -------------------------
export async function GET() {
  // Resolve current user
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1) Load portfolios scoped to the current user
  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      startingCapital: true,
      additionalCapital: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (portfolios.length === 0) {
    return NextResponse.json({
      perPortfolio: {},
      totals: {
        portfolioCount: 0,
        capitalBase: 0,
        currentCapital: 0,
        capitalInUse: 0,
        cashAvailable: 0,
        percentUsed: 0,
        realizedMTD: 0,
        realizedYTD: 0,
      },
      nextExpiration: null as {
        date: string;
        contracts: number;
        topTicker?: string;
      } | null,
      topTickers: [] as Array<{ ticker: string; collateral: number }>,
    });
  }

  const now = new Date();
  const monthStart = startOfMonthUTC();
  const yearStart = startOfYearUTC();
  const ninetyStart = startOfNDaysAgoUTC(89); // 90 days incl today

  // Per-request aggregates (avoid module-scoped mutation across refreshes)
  const globalExposureMap = new Map<string, number>(); // open CSP collateral by ticker
  const globalMtdDaily = new Map<string, number>(); // YYYY-MM-DD -> sum of realized
  const globalYtdMonthly = new Map<string, number>(); // YYYY-MM -> sum of realized
  const globalDaily90 = new Map<string, number>(); // last 90 days, YYYY-MM-DD -> realized

  // Collector for a true global next-expiration across all portfolios
  const allOpenForNext: Array<{
    dateIso: string;
    ticker: string;
    contracts: number;
  }> = [];

  // 2) Per-portfolio snapshots (parallelized)
  const perPortfolioEntries = await Promise.all(
    portfolios.map(async (p) => {
      const [openTrades, closedAll, closedMTD, closedYTD, closed90] =
        await Promise.all([
          prisma.trade.findMany({
            where: { portfolioId: p.id, status: "open" },
            select: {
              ticker: true,
              type: true,
              strikePrice: true,
              contracts: true,
              expirationDate: true,
              createdAt: true,
            },
          }),
          prisma.trade.findMany({
            where: { portfolioId: p.id, status: "closed" },
            select: {
              ticker: true,
              contracts: true,
              contractPrice: true,
              closingPrice: true,
              premiumCaptured: true,
              createdAt: true,
              closedAt: true,
            },
          }),
          prisma.trade.findMany({
            where: {
              portfolioId: p.id,
              status: "closed",
              closedAt: { gte: monthStart },
            },
            select: {
              ticker: true,
              contracts: true,
              contractPrice: true,
              closingPrice: true,
              premiumCaptured: true,
              closedAt: true,
            },
          }),
          prisma.trade.findMany({
            where: {
              portfolioId: p.id,
              status: "closed",
              closedAt: { gte: yearStart },
            },
            select: {
              ticker: true,
              contracts: true,
              contractPrice: true,
              closingPrice: true,
              premiumCaptured: true,
              closedAt: true,
            },
          }),
          prisma.trade.findMany({
            where: {
              portfolioId: p.id,
              status: "closed",
              closedAt: { gte: ninetyStart },
            },
            select: {
              ticker: true,
              contracts: true,
              contractPrice: true,
              closingPrice: true,
              premiumCaptured: true,
              closedAt: true,
            },
          }),
        ]);

      // Capital in use = collateral of CSPs only
      const cspOpen = openTrades.filter((t) => isCSP(t.type));
      const capitalInUse = cspOpen.reduce(
        (sum, t) => sum + collateralFor(t.strikePrice, t.contracts),
        0,
      );

      // Biggest CSP by collateral
      const biggestRaw = cspOpen
        .map((t) => ({
          ticker: t.ticker,
          strikePrice: Number(t.strikePrice),
          contracts: Number(t.contracts),
          expirationDate: new Date(t.expirationDate),
          collateral: collateralFor(t.strikePrice, t.contracts),
        }))
        .sort((a, b) => b.collateral - a.collateral)[0];

      const biggest = biggestRaw
        ? {
            ticker: biggestRaw.ticker,
            strikePrice: biggestRaw.strikePrice,
            contracts: biggestRaw.contracts,
            collateral: biggestRaw.collateral,
            expirationDate: biggestRaw.expirationDate.toISOString(),
          }
        : null;

      // Top ticker exposures (by CSP collateral)
      const byTicker = new Map<string, number>();
      for (const t of cspOpen) {
        const add = collateralFor(t.strikePrice, t.contracts);
        byTicker.set(t.ticker, (byTicker.get(t.ticker) ?? 0) + add);
      }
      // accumulate to global exposure map
      for (const [tk, coll] of byTicker.entries()) {
        globalExposureMap.set(tk, (globalExposureMap.get(tk) ?? 0) + coll);
      }
      const totalColl =
        Array.from(byTicker.values()).reduce((a, b) => a + b, 0) || 1;
      const topTickers = Array.from(byTicker.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([ticker, coll]) => ({
          ticker,
          collateral: coll,
          pct: (coll / totalColl) * 100,
        }));

      // Expirations (per-portfolio) + “expiring in 7 days”
      const expirationsByDay = new Map<number, number>(); // key = UTC midnight millis
      let expiringSoonCount = 0;

      for (const t of openTrades) {
        const contracts = Math.trunc(Number(t.contracts));
        if (!Number.isFinite(contracts) || contracts <= 0) continue; // ignore zero/invalid

        const dMid = ensureUtcMidnight(new Date(t.expirationDate));
        const dayKey = dMid.getTime();
        const todayKey = ensureUtcMidnight(now).getTime();
        if (!Number.isFinite(dayKey)) continue; // skip invalid dates

        // Ignore expirations strictly before today
        if (dayKey < todayKey) continue;

        expirationsByDay.set(
          dayKey,
          (expirationsByDay.get(dayKey) ?? 0) + contracts,
        );

        // Count contracts expiring within 7 days (inclusive), UTC-safe
        const du = Math.ceil((dayKey - todayKey) / DAY_MS);
        if (du >= 0 && du <= 7) expiringSoonCount += contracts;

        // collect for global next-expiration
        allOpenForNext.push({
          dateIso: new Date(dayKey).toISOString().slice(0, 10),
          ticker: t.ticker,
          contracts,
        });
      }

      // Per-portfolio next expiration (earliest FUTURE date with >0 contracts)
      const nextPair = Array.from(expirationsByDay.entries()).sort(
        (a, b) => a[0] - b[0],
      )[0];

      const nextExpiration = nextPair
        ? {
            date: new Date(nextPair[0]).toISOString().slice(0, 10),
            contracts: nextPair[1],
          }
        : null;

      // Open avg age (days)
      const openAvgDays =
        openTrades.length === 0
          ? null
          : Number(
              (
                openTrades.reduce(
                  (s, t) =>
                    s +
                    Math.max(
                      0,
                      (now.getTime() - new Date(t.createdAt).getTime()) /
                        DAY_MS,
                    ),
                  0,
                ) / openTrades.length
              ).toFixed(1),
            );

      // Realized P/L buckets
      const totalProfitAll = sumRealized(closedAll);
      const realizedMTD = sumRealized(closedMTD);
      const realizedYTD = sumRealized(closedYTD);

      // Per-portfolio realized premium by ticker
      const perPremiumMap = new Map<string, number>();
      for (const row of closedAll) {
        const realized = realizedFor({
          contracts: Number(row.contracts),
          contractPrice: Number(row.contractPrice),
          closingPrice:
            row.closingPrice == null ? null : Number(row.closingPrice),
          premiumCaptured:
            row.premiumCaptured == null ? null : Number(row.premiumCaptured),
        });
        if (row.ticker)
          perPremiumMap.set(
            row.ticker,
            (perPremiumMap.get(row.ticker) ?? 0) + realized,
          );
      }
      const perPremiumArray = Array.from(perPremiumMap.entries())
        .map(([ticker, premium]) => ({ ticker, premium }))
        .sort((a, b) => b.premium - a.premium);

      // Build per-portfolio MTD (daily) & YTD (monthly) progress buckets
      const mtdDailyBucket = new Map<string, number>(); // YYYY-MM-DD -> sum
      for (const r of closedMTD) {
        const key = r.closedAt ? toIsoDayUTC(new Date(r.closedAt)) : null;
        if (!key) continue;
        const val = realizedFor({
          contracts: Number(r.contracts),
          contractPrice: Number(r.contractPrice),
          closingPrice: r.closingPrice == null ? null : Number(r.closingPrice),
          premiumCaptured:
            r.premiumCaptured == null ? null : Number(r.premiumCaptured),
        });
        mtdDailyBucket.set(key, (mtdDailyBucket.get(key) ?? 0) + val);
      }

      const ytdMonthlyBucket = new Map<string, number>(); // YYYY-MM -> sum
      for (const r of closedYTD) {
        const d = r.closedAt ? new Date(r.closedAt) : null;
        if (!d) continue;
        const key = toIsoMonthUTC(d);
        const val = realizedFor({
          contracts: Number(r.contracts),
          contractPrice: Number(r.contractPrice),
          closingPrice: r.closingPrice == null ? null : Number(r.closingPrice),
          premiumCaptured:
            r.premiumCaptured == null ? null : Number(r.premiumCaptured),
        });
        ytdMonthlyBucket.set(key, (ytdMonthlyBucket.get(key) ?? 0) + val);
      }

      // 90-day daily bucket (per-portfolio)
      const daily90Bucket = new Map<string, number>(); // YYYY-MM-DD -> sum
      for (const r of closed90) {
        const key = r.closedAt ? toIsoDayUTC(new Date(r.closedAt)) : null;
        if (!key) continue;
        const val = realizedFor({
          contracts: Number(r.contracts),
          contractPrice: Number(r.contractPrice),
          closingPrice: r.closingPrice == null ? null : Number(r.closingPrice),
          premiumCaptured:
            r.premiumCaptured == null ? null : Number(r.premiumCaptured),
        });
        daily90Bucket.set(key, (daily90Bucket.get(key) ?? 0) + val);
      }

      // Accumulate into global 90-day bucket
      for (const [day, val] of daily90Bucket.entries()) {
        globalDaily90.set(day, (globalDaily90.get(day) ?? 0) + val);
      }

      // Accumulate into global series buckets
      for (const [day, val] of mtdDailyBucket.entries()) {
        globalMtdDaily.set(day, (globalMtdDaily.get(day) ?? 0) + val);
      }
      for (const [mon, val] of ytdMonthlyBucket.entries()) {
        globalYtdMonthly.set(mon, (globalYtdMonthly.get(mon) ?? 0) + val);
      }

      // Convert per-portfolio buckets to ordered cumulative series
      const mtdSeries = (() => {
        const series: { label: string; realized: number }[] = [];
        const start = monthStart;
        const today = ensureUtcMidnight(now);
        let run = 0;
        for (
          let d = new Date(start);
          d.getTime() <= today.getTime();
          d = new Date(d.getTime() + DAY_MS)
        ) {
          const key = toIsoDayUTC(d);
          run += mtdDailyBucket.get(key) ?? 0;
          series.push({ label: key, realized: run });
        }
        return series;
      })();

      const ytdSeries = (() => {
        const series: { label: string; realized: number }[] = [];
        const first = yearStart;
        let cursor = new Date(Date.UTC(first.getUTCFullYear(), 0, 1));
        const lastMonthIndex = now.getUTCMonth();
        let run = 0;
        for (let m = 0; m <= lastMonthIndex; m++) {
          const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
          run += ytdMonthlyBucket.get(key) ?? 0;
          series.push({ label: key, realized: run });
          cursor = new Date(
            Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
          );
        }
        return series;
      })();

      const daily90Series = (() => {
        const series: { label: string; realized: number }[] = [];
        const start = ninetyStart;
        const today = ensureUtcMidnight(now);
        let run = 0;
        for (
          let d = new Date(start);
          d.getTime() <= today.getTime();
          d = new Date(d.getTime() + DAY_MS)
        ) {
          const key = toIsoDayUTC(d);
          run += daily90Bucket.get(key) ?? 0;
          series.push({ label: key, realized: run });
        }
        return series;
      })();

      // Capital figures
      const starting = Number(p.startingCapital ?? 0);
      const additional = Number(p.additionalCapital ?? 0);
      const capitalBase = starting + additional;
      const currentCapital = capitalBase + totalProfitAll; // realized adjusts the base
      const cashAvailable = currentCapital - capitalInUse;

      return [
        p.id,
        {
          portfolioId: p.id,
          name: p.name,
          startingCapital: starting,
          additionalCapital: additional,
          capitalBase,
          currentCapital,
          totalProfitAll,
          openCount: openTrades.length,
          capitalInUse,
          cashAvailable,
          biggest,
          topTickers,
          nextExpiration,
          expiringSoonCount,
          openAvgDays,
          realizedMTD,
          realizedYTD,
          // per-portfolio visuals data
          exposures: Array.from(byTicker.entries())
            .map(([ticker, coll]) => ({
              ticker,
              weightPct: (coll / totalColl) * 100,
            }))
            .sort((a, b) => b.weightPct - a.weightPct),
          premiumByTicker: perPremiumArray,
          pnlSeriesMTD: mtdSeries,
          pnlSeriesYTD: ytdSeries,
          pnlSeriesDaily90: daily90Series,
        },
      ] as const;
    }),
  );

  const perPortfolio = Object.fromEntries(perPortfolioEntries);

  // Global premium-by-ticker recomputed from per-portfolio arrays (idempotent per request)
  const globalPremiumMap = new Map<string, number>();
  for (const p of Object.values(perPortfolio)) {
    const arr = p.premiumByTicker as
      | Array<{ ticker: string; premium: number }>
      | undefined;
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      if (!row?.ticker) continue;
      globalPremiumMap.set(
        row.ticker,
        (globalPremiumMap.get(row.ticker) ?? 0) + Number(row.premium || 0),
      );
    }
  }
  const premiumByTicker = Array.from(globalPremiumMap.entries())
    .map(([ticker, premium]) => ({ ticker, premium }))
    .sort((a, b) => b.premium - a.premium);

  // 3) Totals & aggregates across portfolios
  const baseTotals = Object.values(perPortfolio).reduce(
    (acc, p) => {
      acc.portfolioCount += 1;
      acc.capitalBase += p.capitalBase;
      acc.currentCapital += p.currentCapital;
      acc.capitalInUse += p.capitalInUse;
      acc.cashAvailable += p.cashAvailable;
      acc.realizedMTD += p.realizedMTD;
      acc.realizedYTD += p.realizedYTD;
      return acc;
    },
    {
      portfolioCount: 0,
      capitalBase: 0,
      currentCapital: 0,
      capitalInUse: 0,
      cashAvailable: 0,
      realizedMTD: 0,
      realizedYTD: 0,
    },
  );

  const percentUsed =
    baseTotals.currentCapital > 0
      ? (baseTotals.capitalInUse / baseTotals.currentCapital) * 100
      : 0;

  // Global ordered cumulative MTD/YTD series
  const mtdSeries: { label: string; realized: number }[] = (() => {
    const series: { label: string; realized: number }[] = [];
    const start = monthStart;
    const today = ensureUtcMidnight(now);
    let run = 0;
    for (
      let d = new Date(start);
      d.getTime() <= today.getTime();
      d = new Date(d.getTime() + DAY_MS)
    ) {
      const key = toIsoDayUTC(d);
      run += globalMtdDaily.get(key) ?? 0;
      series.push({ label: key, realized: run });
    }
    return series;
  })();

  const ytdSeries: { label: string; realized: number }[] = (() => {
    const series: { label: string; realized: number }[] = [];
    const first = yearStart;
    // Start at Jan 1 (UTC) of the current year
    let cursor = new Date(Date.UTC(first.getUTCFullYear(), 0, 1));
    const lastMonthIndex = now.getUTCMonth();
    let run = 0;
    for (let m = 0; m <= lastMonthIndex; m++) {
      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
      run += globalYtdMonthly.get(key) ?? 0;
      series.push({ label: key, realized: run });
      cursor = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
      );
    }
    return series;
  })();

  // Global 90-day daily cumulative series
  const daily90Series: { label: string; realized: number }[] = (() => {
    const series: { label: string; realized: number }[] = [];
    const start = ninetyStart;
    const today = ensureUtcMidnight(now);
    let run = 0;
    for (
      let d = new Date(start);
      d.getTime() <= today.getTime();
      d = new Date(d.getTime() + DAY_MS)
    ) {
      const key = toIsoDayUTC(d);
      run += globalDaily90.get(key) ?? 0;
      series.push({ label: key, realized: run });
    }
    return series;
  })();

  // Derive global exposures (as percentages of total open CSP collateral)
  const totalExposureColl =
    Array.from(globalExposureMap.values()).reduce((a, b) => a + b, 0) || 1;
  const exposures = Array.from(globalExposureMap.entries())
    .map(([ticker, coll]) => ({
      ticker,
      weightPct: (coll / totalExposureColl) * 100,
    }))
    .sort((a, b) => b.weightPct - a.weightPct);

  // Global next expiration (earliest FUTURE date, contracts > 0, with top ticker on that date)
  let nextExpiration: {
    date: string;
    contracts: number;
    topTicker?: string;
  } | null = null;

  if (allOpenForNext.length > 0) {
    // fold into UTC-day buckets numerically
    const byDay = new Map<
      number,
      { contracts: number; byTicker: Map<string, number> }
    >();
    const todayKey = ensureUtcMidnight(now).getTime();

    for (const row of allOpenForNext) {
      const dayKey = ensureUtcMidnight(row.dateIso).getTime();
      const contracts = Math.trunc(Number(row.contracts));
      if (!Number.isFinite(dayKey)) continue; // skip invalid dates
      if (contracts <= 0) continue;
      if (dayKey < todayKey) continue;

      const entry = byDay.get(dayKey) ?? {
        contracts: 0,
        byTicker: new Map<string, number>(),
      };
      entry.contracts += contracts;
      entry.byTicker.set(
        row.ticker,
        (entry.byTicker.get(row.ticker) ?? 0) + contracts,
      );
      byDay.set(dayKey, entry);
    }

    const earliest = Array.from(byDay.entries()).sort((a, b) => a[0] - b[0])[0];
    if (earliest) {
      const [dayKey, info] = earliest;
      let topTicker: string | undefined;
      let topCount = -1;
      for (const [tk, cnt] of info.byTicker.entries()) {
        if (cnt > topCount) {
          topCount = cnt;
          topTicker = tk;
        }
      }
      nextExpiration = {
        date: new Date(dayKey).toISOString().slice(0, 10),
        contracts: info.contracts,
        topTicker,
      };
    }
  }

  // Global top tickers by CSP collateral
  const aggTickerMap = new Map<string, number>();
  for (const p of Object.values(perPortfolio)) {
    for (const t of p.topTickers) {
      aggTickerMap.set(
        t.ticker,
        (aggTickerMap.get(t.ticker) ?? 0) + t.collateral,
      );
    }
  }
  const topTickers = Array.from(aggTickerMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ticker, collateral]) => ({ ticker, collateral }));

  return NextResponse.json({
    perPortfolio,
    totals: { ...baseTotals, percentUsed },
    nextExpiration,
    topTickers,
    exposures,
    premiumByTicker,
    pnlSeriesMTD: mtdSeries,
    pnlSeriesYTD: ytdSeries,
    pnlSeriesDaily90: daily90Series,
  });
}
