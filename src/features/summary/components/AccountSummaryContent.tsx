"use client";

import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type ExposureEntry = { ticker: string; weightPct: number };
type TickerPremium = { ticker: string; premium: number };

type SummaryPortfolio = {
  portfolioId: string;
  name: string;
  startingCapital: number;
  additionalCapital: number;
  capitalBase: number;
  currentCapital: number;
  totalProfitAll: number;
  openCount: number;
  capitalInUse: number;
  cashAvailable: number;
  biggest: {
    ticker: string;
    strikePrice: number;
    contracts: number;
    collateral: number;
    expirationDate: string;
  } | null;
  topTickers: { ticker: string; collateral: number; pct: number }[];
  nextExpiration: {
    date: string;
    contracts: number;
    topTicker?: string;
  } | null;
  expiringSoonCount: number;
  openAvgDays: number | null;
  realizedMTD: number;
  realizedYTD: number;
  exposures: ExposureEntry[];
  premiumByTicker: TickerPremium[];
  pnlSeriesMTD: { label: string; realized: number }[];
  pnlSeriesYTD: { label: string; realized: number }[];
  pnlSeriesDaily90: { label: string; realized: number }[];
};

type SummaryResponse = {
  perPortfolio: Record<string, SummaryPortfolio>;
  totals: {
    portfolioCount: number;
    capitalBase: number;
    currentCapital: number;
    capitalInUse: number;
    cashAvailable: number;
    percentUsed: number;
    realizedMTD: number;
    realizedYTD: number;
  };
  nextExpiration: {
    date: string;
    contracts: number;
    topTicker?: string;
  } | null;
  topTickers: { ticker: string; collateral: number }[];
  exposures: ExposureEntry[]; // global exposures by ticker (% of CSP collateral)
  premiumByTicker: TickerPremium[]; // realized premium by ticker
  pnlSeriesMTD: { label: string; realized: number }[];
  pnlSeriesYTD: { label: string; realized: number }[];
  pnlSeriesDaily90: { label: string; realized: number }[];
};

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}
function formatLongCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
function pctColor(p: number) {
  if (p > 85) return "text-red-700";
  if (p >= 60) return "text-amber-700";
  return "text-green-700";
}
function moneyColor(v: number) {
  if (v > 0) return "text-green-700 dark:text-green-200";
  if (v < 0) return "text-red-700 dark:text-red-300";
  return "text-gray-700 dark:text-gray-300";
}

// Chart components
function DonutChart({
  data,
  size = 160,
}: {
  data: { label: string; value: number }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = rOuter * 0.6;
  let startAngle = -Math.PI / 2;
  const hueBase = 200;

  const arcs = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const x0 = cx + rOuter * Math.cos(startAngle);
    const y0 = cy + rOuter * Math.sin(startAngle);
    const x1 = cx + rOuter * Math.cos(endAngle);
    const y1 = cy + rOuter * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x1} ${y1} L ${cx + rInner * Math.cos(endAngle)} ${cy + rInner * Math.sin(endAngle)} A ${rInner} ${rInner} 0 ${largeArc} 0 ${cx + rInner * Math.cos(startAngle)} ${cy + rInner * Math.sin(startAngle)} Z`;
    const fill = `hsl(${(hueBase + i * 35) % 360} 70% 50%)`;
    startAngle = endAngle;
    return { path, fill, key: `${d.label}-${i}` };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Donut chart"
    >
      {arcs.map((a) => (
        <path key={a.key} d={a.path} fill={a.fill} />
      ))}
      <circle
        cx={cx}
        cy={cy}
        r={rInner}
        fill="white"
        className="dark:fill-gray-900"
      />
    </svg>
  );
}

function HorizontalBars({
  data,
  valueKey = "value",
  labelKey = "label",
}: {
  data: Array<Record<string, number | string>>;
  valueKey?: string;
  labelKey?: string;
}) {
  const typed = data as Array<{ [k: string]: number | string }>;
  const max = Math.max(1, ...typed.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="space-y-2">
      {typed.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={`${String(d[labelKey])}-${i}`} className="w-full">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {String(d[labelKey])}
              </span>
              <span className="tabular-nums text-gray-600 dark:text-gray-400">
                {formatCompactCurrency(val)}
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded">
              <div
                className="h-2 rounded"
                style={{
                  width: `${pct}%`,
                  backgroundColor: `hsl(${(210 + i * 27) % 360} 70% 45%)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AccountSummaryContent() {
  const { data, isLoading, error } = useSWR<SummaryResponse>(
    "/api/account/summary",
  );

  const agg = (() => {
    if (!data) {
      return {
        accountStarting: 0,
        accountAdditional: 0,
        accountBase: 0,
        accountProfit: 0,
        accountCurrentCapital: 0,
        accountCapitalUsed: 0,
        accountPercentUsed: 0,
        accountCashAvailable: 0,
        totalOpenTrades: 0,
        totalRealizedMTD: 0,
        totalRealizedYTD: 0,
        totalExpiringSoon: 0,
        nextExpiration: null as {
          date: string;
          contracts: number;
          topTicker?: string;
        } | null,
        exposures: [] as ExposureEntry[],
        premiumByTicker: [] as TickerPremium[],
        topExposures: [] as { ticker: string; pct: number }[],
        perPortfolio: [] as {
          id: string;
          name: string;
          pctUsed: number;
          open: number;
          soon: number;
        }[],
      };
    }

    const portfolios = Object.values(data.perPortfolio);

    const accountStarting = portfolios.reduce(
      (s, p) => s + p.startingCapital,
      0,
    );
    const accountAdditional = portfolios.reduce(
      (s, p) => s + p.additionalCapital,
      0,
    );
    const accountBase = data.totals.capitalBase;
    const accountCurrentCapital = data.totals.currentCapital;
    const accountProfit = portfolios.reduce((s, p) => s + p.totalProfitAll, 0);
    const accountCapitalUsed = data.totals.capitalInUse;
    const accountPercentUsed = data.totals.percentUsed;
    const accountCashAvailable = data.totals.cashAvailable;

    const totalOpenTrades = portfolios.reduce((s, p) => s + p.openCount, 0);
    const totalRealizedMTD = data.totals.realizedMTD;
    const totalRealizedYTD = data.totals.realizedYTD;
    const totalExpiringSoon = portfolios.reduce(
      (s, p) => s + p.expiringSoonCount,
      0,
    );

    const nextExpiration = data.nextExpiration; // may include topTicker

    // Top exposures: already as percentages from API
    const topExposures: { ticker: string; pct: number }[] = (
      data.exposures ?? []
    )
      .sort((a, b) => b.weightPct - a.weightPct)
      .slice(0, 5)
      .map((e) => ({ ticker: e.ticker, pct: e.weightPct }));

    // Per-portfolio chips
    const perPortfolio = portfolios.map((p) => {
      const denom = p.currentCapital > 0 ? p.currentCapital : p.capitalBase; // fall back if needed
      const pctUsed = denom > 0 ? (p.capitalInUse / denom) * 100 : 0;
      return {
        id: p.portfolioId,
        name: p.name,
        pctUsed,
        open: p.openCount,
        soon: p.expiringSoonCount,
      };
    });

    const premiumByTicker = [...(data.premiumByTicker ?? [])];

    return {
      accountStarting,
      accountAdditional,
      accountBase,
      accountProfit,
      accountCurrentCapital,
      accountCapitalUsed,
      accountPercentUsed,
      accountCashAvailable,
      totalOpenTrades,
      totalRealizedMTD,
      totalRealizedYTD,
      totalExpiringSoon,
      nextExpiration,
      exposures: data.exposures ?? [],
      premiumByTicker,
      topExposures,
      perPortfolio,
    };
  })();

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("all");
  const portfoliosArray = useMemo(
    () => (data ? Object.values(data.perPortfolio) : []),
    [data],
  );

  const selectedPortfolio = useMemo(
    () =>
      selectedPortfolioId !== "all"
        ? (portfoliosArray.find((p) => p.portfolioId === selectedPortfolioId) ??
          null)
        : null,
    [selectedPortfolioId, portfoliosArray],
  );

  function buildAggFromPortfolio(p: SummaryPortfolio) {
    const accountStarting = p.startingCapital;
    const accountAdditional = p.additionalCapital;
    const accountBase = p.capitalBase;
    const accountCurrentCapital = p.currentCapital;
    const accountProfit = p.totalProfitAll;
    const accountCapitalUsed = p.capitalInUse;
    const accountPercentUsed =
      accountCurrentCapital > 0
        ? (p.capitalInUse / accountCurrentCapital) * 100
        : 0;
    const accountCashAvailable = p.cashAvailable;

    const totalOpenTrades = p.openCount;
    const totalRealizedMTD = p.realizedMTD;
    const totalRealizedYTD = p.realizedYTD;
    const totalExpiringSoon = p.expiringSoonCount;
    const nextExpiration = p.nextExpiration ? { ...p.nextExpiration } : null;

    return {
      accountStarting,
      accountAdditional,
      accountBase,
      accountProfit,
      accountCurrentCapital,
      accountCapitalUsed,
      accountPercentUsed,
      accountCashAvailable,
      totalOpenTrades,
      totalRealizedMTD,
      totalRealizedYTD,
      totalExpiringSoon,
      nextExpiration,
    };
  }

  const view = useMemo(() => {
    if (!selectedPortfolio) return agg; // global view
    const base = buildAggFromPortfolio(selectedPortfolio);
    return { ...agg, ...base };
  }, [agg, selectedPortfolio]);

  // Charts & series should honor the toggle (All vs Selected portfolio)
  const chartExposures = useMemo(() => {
    const source = selectedPortfolio
      ? selectedPortfolio.exposures
      : (data?.exposures ?? []);
    return [...source]
      .sort((a, b) => b.weightPct - a.weightPct)
      .slice(0, 5)
      .map((e) => ({ ticker: e.ticker, pct: e.weightPct }));
  }, [selectedPortfolio, data]);

  const chartPremiumByTicker = useMemo(() => {
    const source = selectedPortfolio
      ? selectedPortfolio.premiumByTicker
      : agg.premiumByTicker;
    return source ? [...source] : [];
  }, [selectedPortfolio, agg]);

  const chartYtdSeries = useMemo(() => {
    return selectedPortfolio
      ? selectedPortfolio.pnlSeriesYTD
      : (data?.pnlSeriesYTD ?? []);
  }, [selectedPortfolio, data]);

  const chartDaily90Series = useMemo(() => {
    return selectedPortfolio
      ? selectedPortfolio.pnlSeriesDaily90
      : (data?.pnlSeriesDaily90 ?? []);
  }, [selectedPortfolio, data]);

  // Timeline granularity: daily, weekly (from 90-day daily), monthly (YTD)
  const [timelineMode, setTimelineMode] = useState<
    "daily" | "weekly" | "monthly"
  >("weekly");

  function parseUtcDate(label: string) {
    // label is 'YYYY-MM-DD' or 'YYYY-MM'
    if (label.length === 10) return new Date(label + "T00:00:00.000Z");
    if (label.length === 7) return new Date(label + "-01T00:00:00.000Z");
    return new Date(label);
  }
  function isoWeekKey(d: Date) {
    // ISO week number
    const date = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    // Thursday in current week decides the year
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
      ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  const timelineSeries = useMemo(() => {
    if (timelineMode === "daily") {
      // last 90 days cumulative by day
      return chartDaily90Series;
    }
    if (timelineMode === "weekly") {
      // group 90-day daily by ISO week, take the last cumulative point per week
      const map = new Map<string, number>();
      chartDaily90Series.forEach((pt) => {
        const key = isoWeekKey(parseUtcDate(pt.label));
        map.set(key, pt.realized); // last in week wins
      });
      return Array.from(map.entries()).map(([label, realized]) => ({
        label,
        realized,
      }));
    }
    // monthly (YTD monthly cumulative)
    return chartYtdSeries;
  }, [timelineMode, chartDaily90Series, chartYtdSeries]);

  if (isLoading) {
    return <div className="max-w-5xl mx-auto py-16 px-6">Loading...</div>;
  }
  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-16 px-6 text-red-600">
        Failed to load portfolios.
      </div>
    );
  }

  // Empty state: no portfolios
  const hasNoPortfolios =
    data && Object.keys(data.perPortfolio || {}).length === 0;
  if (hasNoPortfolios) {
    return (
      <div className="max-w-3xl mx-auto py-24 px-6 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Welcome!
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          You don&apos;t have any portfolios yet. Create your first portfolio to
          start tracking trades and premiums
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild variant="default" size="lg">
            <Link href="/overview">Go to Your Portfolios</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Minimal line chart for P&L (with simple axes)
  function LineChartMini({
    data,
    height = 140,
  }: {
    data: { label: string; realized: number }[];
    height?: number;
  }) {
    if (!data || data.length === 0)
      return (
        <div className="text-xs text-gray-500 dark:text-gray-400">No data</div>
      );

    // Layout
    const margin = { top: 8, right: 8, bottom: 18, left: 48 };
    const w = 460;
    const h = height;
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    // Data stats
    const ys = data.map((d) => d.realized);
    const minY = Math.min(0, ...ys);
    const maxY = Math.max(0, ...ys);
    const yRange = Math.max(1, maxY - minY || 1);

    // Scales
    const xScale = (i: number) =>
      margin.left + (i * innerW) / Math.max(1, data.length - 1);
    const yScale = (v: number) =>
      margin.top + innerH - ((v - minY) * innerH) / yRange;

    // Axis ticks (Y: min, 0 (if within domain), max)
    const yTicks: number[] = [];
    yTicks.push(minY);
    if (minY < 0 && maxY > 0) yTicks.push(0);
    if (maxY !== minY) yTicks.push(maxY);

    // Label formatter for compact currency
    const formatMoney = (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);

    // X ticks: first, middle, last
    const xTickIdxs = Array.from(
      new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]),
    ).filter((i) => i >= 0);
    const formatX = (s: string) => {
      // Accept 'YYYY-MM-DD' or 'YYYY-MM'
      if (s.length === 10) return `${s.slice(5, 7)}/${s.slice(8, 10)}`; // MM/DD
      if (s.length === 7) return s; // YYYY-MM
      return s;
    };

    const linePoints = data
      .map((d, i) => `${xScale(i)},${yScale(d.realized)}`)
      .join(" ");

    return (
      <svg
        width={w}
        height={h}
        className="w-full"
        role="img"
        aria-label="Line chart with axes"
      >
        {/* Axes */}
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + innerH}
          stroke="currentColor"
          className="text-gray-300 dark:text-gray-600"
        />
        <line
          x1={margin.left}
          y1={margin.top + innerH}
          x2={margin.left + innerW}
          y2={margin.top + innerH}
          stroke="currentColor"
          className="text-gray-300 dark:text-gray-600"
        />

        {/* Y ticks + labels */}
        {yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line
              x1={margin.left - 4}
              x2={margin.left}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke="currentColor"
              className="text-gray-400"
            />
            <text
              x={margin.left - 6}
              y={yScale(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-gray-500 dark:fill-gray-400 text-[10px]"
            >
              {formatMoney(t)}
            </text>
          </g>
        ))}

        {/* X ticks + labels */}
        {xTickIdxs.map((idx, i) => (
          <g key={`x-${i}`}>
            <line
              x1={xScale(idx)}
              x2={xScale(idx)}
              y1={margin.top + innerH}
              y2={margin.top + innerH + 4}
              stroke="currentColor"
              className="text-gray-400"
            />
            <text
              x={xScale(idx)}
              y={margin.top + innerH + 10}
              textAnchor="middle"
              className="fill-gray-500 dark:fill-gray-400 text-[10px]"
            >
              {formatX(data[idx].label)}
            </text>
          </g>
        ))}

        {/* Zero line if needed */}
        {minY < 0 && maxY > 0 && (
          <line
            x1={margin.left}
            x2={margin.left + innerW}
            y1={yScale(0)}
            y2={yScale(0)}
            stroke="currentColor"
            strokeDasharray="3 3"
            className="text-gray-400/60"
          />
        )}

        {/* Data line */}
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          points={linePoints}
          className="text-blue-600 dark:text-blue-300"
        />
      </svg>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-16 px-6 space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{ willChange: "opacity, transform" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Account Summary
            </h1>
            <div className="mt-2 flex items-center gap-3">
              <label
                htmlFor="portfolioFilter"
                className="text-xs text-gray-600 dark:text-gray-400"
              >
                View:
              </label>
              <Select
                value={selectedPortfolioId}
                onValueChange={setSelectedPortfolioId}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {agg.perPortfolio.map((pp) => (
                    <SelectItem key={pp.id} value={pp.id}>
                      {pp.name || pp.id.slice(0, 6)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="shrink-0 mt-1">
            <Button asChild size="sm">
              <Link href="/overview">View Portfolios</Link>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Section A+B: Overview & Operations */}
      <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl">
        <CardContent className="p-6">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Overview & Ops
            </h2>
            <span
              className={`text-xs font-medium ${pctColor(view.accountPercentUsed)}`}
            >{`% Used: ${view.accountPercentUsed.toFixed(1)}%`}</span>
          </div>

          {/* Key figures row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Current Capital
              </p>
              <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
                {formatLongCurrency(view.accountCurrentCapital)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{`Base ${formatLongCurrency(view.accountBase)} (Start ${formatLongCurrency(view.accountStarting)} · Addl ${formatLongCurrency(view.accountAdditional)})`}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{`Realized ${formatCompactCurrency(view.accountProfit)}`}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Capital In Use
              </p>
              <p className="mt-1 text-3xl font-semibold text-amber-800 dark:text-amber-100">
                {formatLongCurrency(view.accountCapitalUsed)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Cash Available
              </p>
              <p
                className={`mt-1 text-3xl font-semibold ${view.accountCashAvailable < 0 ? "text-red-700 dark:text-red-400" : "text-green-800 dark:text-green-100"}`}
              >
                {formatLongCurrency(view.accountCashAvailable)}
              </p>
            </div>
          </div>

          {/* Ops row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Open Trades
              </p>
              <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
                {view.totalOpenTrades}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Next Expiration
              </p>
              <p className="mt-1 text-base font-medium text-blue-900 dark:text-blue-200">
                {view.nextExpiration
                  ? `${formatDateOnlyUTC(view.nextExpiration.date)} · ${view.nextExpiration.contracts} contracts${
                      view.nextExpiration.topTicker
                        ? ` · ${view.nextExpiration.topTicker}`
                        : ""
                    }`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Expiring ≤ 7 Days
              </p>
              <p className="mt-1 text-3xl font-semibold text-rose-800 dark:text-rose-100">
                {view.totalExpiringSoon}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section B: Priority Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Top Exposures
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">{`by % collateral (${selectedPortfolio ? "selected" : "all"})`}</span>
            </div>
            {chartExposures.length ? (
              <div className="flex flex-col items-center gap-4">
                <DonutChart
                  data={chartExposures.map((t) => ({
                    label: t.ticker,
                    value: t.pct,
                  }))}
                  size={220}
                />
                <ul className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 w-full">
                  {chartExposures.map((t, idx) => (
                    <li key={t.ticker} className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: `hsl(${(200 + idx * 35) % 360} 70% 50%)`,
                        }}
                      />
                      <span className="font-medium">{t.ticker}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {t.pct.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No exposures to display
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Premium by Ticker (realized)
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Top earners
              </span>
            </div>
            {chartPremiumByTicker.length ? (
              <HorizontalBars
                data={chartPremiumByTicker.map((p) => ({
                  label: p.ticker,
                  value: p.premium,
                }))}
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No realized premium yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section C: Realized P&L */}
      <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl">
        <CardContent className="p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Realized P&L
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Cumulative (select Daily/Weekly/Monthly)
            </span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Total Realized P&amp;L:&nbsp;
              </span>
              <span
                className={`font-semibold ${moneyColor(view.accountProfit)}`}
              >
                {formatCompactCurrency(view.accountProfit)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Timeline
              </span>
              <Select
                value={timelineMode}
                onValueChange={(v: "daily" | "weekly" | "monthly") =>
                  setTimelineMode(v)
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Granularity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="w-full">
            <LineChartMini data={timelineSeries} height={320} />
          </div>
        </CardContent>
      </Card>

      {/* Per-portfolio chips */}
      <motion.div
        className="mt-2"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.42 }}
        style={{ willChange: "opacity, transform" }}
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          By portfolio (each chip: Portfolio Name · % Used · Open positions ·
          Expiring ≤7d)
        </p>
        <div className="flex flex-wrap gap-2 bg-white dark:bg-gray-800 p-2 rounded">
          {agg.perPortfolio.map((pp, i) => (
            <motion.span
              key={pp.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.02 * i }}
              className={`text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 ${pctColor(pp.pctUsed)} dark:text-gray-100`}
              title={`% Used is Capital In Use / Current Capital. Open = open positions. Exp ≤7d = contracts expiring in the next 7 days. (% Used ${pp.pctUsed.toFixed(1)} · Open ${pp.open} · Exp ≤7d ${pp.soon})`}
            >
              {`${pp.name || pp.id.slice(0, 4) + "…"} · ${pp.pctUsed.toFixed(0)}% used · ${pp.open} open · ${pp.soon} ≤7d`}
            </motion.span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
