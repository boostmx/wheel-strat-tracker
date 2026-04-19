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
  winRate: number | null;
  avgDaysInTrade: number | null;
  closedTradeCount: number;
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
  if (p > 85) return "text-destructive";
  if (p >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-700 dark:text-emerald-400";
}
function moneyColor(v: number) {
  if (v > 0) return "text-emerald-700 dark:text-emerald-400";
  if (v < 0) return "text-destructive";
  return "text-muted-foreground";
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
        className="fill-card"
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
  const max = Math.max(1, ...typed.map((d) => Math.abs(Number(d[valueKey]) || 0)));
  return (
    <div className="space-y-2">
      {typed.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (Math.abs(val) / max) * 100;
        const isNeg = val < 0;
        return (
          <div key={`${String(d[labelKey])}-${i}`} className="w-full">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-foreground">
                {String(d[labelKey])}
              </span>
              <span className={`tabular-nums ${isNeg ? "text-red-500" : "text-muted-foreground"}`}>
                {formatCompactCurrency(val)}
              </span>
            </div>
            <div className="h-2 bg-muted rounded">
              <div
                className="h-2 rounded"
                style={{
                  width: `${pct}%`,
                  backgroundColor: isNeg
                    ? "hsl(0 70% 50%)"
                    : `hsl(${(210 + i * 27) % 360} 70% 45%)`,
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

    // Aggregate win rate and avg days across all portfolios (weighted by closed count)
    const totalClosed = portfolios.reduce((s, p) => s + (p.closedTradeCount ?? 0), 0);
    const winRate = totalClosed > 0
      ? portfolios.reduce((s, p) => s + ((p.winRate ?? 0) / 100) * (p.closedTradeCount ?? 0), 0) / totalClosed * 100
      : null;
    const avgDaysInTrade = totalClosed > 0
      ? portfolios.reduce((s, p) => s + (p.avgDaysInTrade ?? 0) * (p.closedTradeCount ?? 0), 0) / totalClosed
      : null;

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
      winRate,
      avgDaysInTrade,
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
    const winRate = p.winRate ?? null;
    const avgDaysInTrade = p.avgDaysInTrade ?? null;

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
      winRate,
      avgDaysInTrade,
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

  const chartMtdSeries = useMemo(() => {
    return selectedPortfolio
      ? selectedPortfolio.pnlSeriesMTD
      : (data?.pnlSeriesMTD ?? []);
  }, [selectedPortfolio, data]);

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

  const [activeTab, setActiveTab] = useState<"mtd" | "90d" | "ytd">("90d");

  const timelineSeries = useMemo(() => {
    if (activeTab === "mtd") return chartMtdSeries;
    if (activeTab === "90d") return chartDaily90Series;
    return chartYtdSeries;
  }, [activeTab, chartMtdSeries, chartDaily90Series, chartYtdSeries]);

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
        <h1 className="text-3xl font-bold text-foreground">
          Welcome!
        </h1>
        <p className="mt-3 text-muted-foreground">
          You don&apos;t have any portfolios yet. Create your first portfolio to
          start tracking trades and premiums and see your account summary here.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild variant="default" size="lg">
            <Link href="/portfolios">Go to Your Portfolios</Link>
          </Button>
        </div>
      </div>
    );
  }

  function PnLChart({
    data,
    height = 280,
  }: {
    data: { label: string; realized: number }[];
    height?: number;
  }) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    if (!data || data.length === 0)
      return <div className="text-xs text-muted-foreground py-8 text-center">No data for this period</div>;

    const margin = { top: 16, right: 16, bottom: 32, left: 58 };
    const W = 600;
    const H = height;
    const iW = W - margin.left - margin.right;
    const iH = H - margin.top - margin.bottom;

    const ys = data.map((d) => d.realized);
    const rawMin = Math.min(0, ...ys);
    const rawMax = Math.max(0, ...ys);
    const pad = (rawMax - rawMin) * 0.12 || 10;
    const yMin = rawMin - pad;
    const yMax = rawMax + pad;
    const yRange = Math.max(1, yMax - yMin);

    const xScale = (i: number) => margin.left + (i * iW) / Math.max(1, data.length - 1);
    const yScale = (v: number) => margin.top + iH - ((v - yMin) * iH) / yRange;

    const finalVal = ys[ys.length - 1] ?? 0;
    const isPos = finalVal >= 0;
    const lineColor = isPos ? "#22c55e" : "#ef4444";
    const gradId = "pnl-grad";

    // 5 evenly spaced Y gridlines
    const yGridVals = Array.from({ length: 5 }, (_, i) => rawMin + ((rawMax - rawMin) / 4) * i);
    if (!yGridVals.includes(0) && rawMin < 0 && rawMax > 0) yGridVals.push(0);

    // X labels: up to 6, evenly spaced
    const maxLabels = Math.min(6, data.length);
    const xIdxs = Array.from({ length: maxLabels }, (_, i) =>
      Math.round((i * (data.length - 1)) / Math.max(1, maxLabels - 1)),
    );

    const formatMoney = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);

    const formatX = (s: string) => {
      if (s.length === 10) return `${s.slice(5, 7)}/${s.slice(8, 10)}`;
      if (s.length === 7) return s.slice(5); // show only MM from YYYY-MM
      return s;
    };

    const pts = data.map((d, i) => `${xScale(i)},${yScale(d.realized)}`).join(" ");
    const areaD = [
      `M ${xScale(0)},${yScale(0)}`,
      ...data.map((d, i) => `L ${xScale(i)},${yScale(d.realized)}`),
      `L ${xScale(data.length - 1)},${yScale(0)} Z`,
    ].join(" ");

    const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;
    const tooltipX = hoveredIdx !== null ? xScale(hoveredIdx) : 0;
    const tooltipY = hovered ? yScale(hovered.realized) : 0;
    const flipTooltip = tooltipX > W * 0.65;

    return (
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible cursor-crosshair"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const scaleX = W / rect.width;
          const mx = (e.clientX - rect.left) * scaleX - margin.left;
          const idx = Math.round((mx / iW) * (data.length - 1));
          setHoveredIdx(Math.max(0, Math.min(data.length - 1, idx)));
        }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Y gridlines + labels */}
        {yGridVals.map((v, i) => {
          const y = yScale(v);
          const isZero = v === 0;
          return (
            <g key={i}>
              <line
                x1={margin.left} x2={margin.left + iW}
                y1={y} y2={y}
                stroke={isZero ? "#9ca3af" : "#e5e7eb"}
                strokeWidth={isZero ? 1 : 0.5}
                strokeDasharray={isZero ? "4 4" : undefined}
                className="dark:[&]:stroke-gray-600"
              />
              <text x={margin.left - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} className="fill-muted-foreground">
                {formatMoney(v)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill={`url(#${gradId})`} />

        {/* Line */}
        <polyline fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={pts} />

        {/* X labels */}
        {xIdxs.map((idx) => (
          <text key={idx} x={xScale(idx)} y={margin.top + iH + 20} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
            {formatX(data[idx].label)}
          </text>
        ))}

        {/* Endpoint dot (when not hovering) */}
        {hoveredIdx === null && (
          <circle cx={xScale(data.length - 1)} cy={yScale(finalVal)} r={4} fill={lineColor} stroke="white" strokeWidth={1.5} />
        )}

        {/* Hover crosshair + tooltip */}
        {hovered && hoveredIdx !== null && (
          <g>
            <line x1={tooltipX} x2={tooltipX} y1={margin.top} y2={margin.top + iH}
              stroke="#9ca3af" strokeWidth={1} strokeDasharray="4 3" />
            <circle cx={tooltipX} cy={tooltipY} r={4.5} fill={lineColor} stroke="white" strokeWidth={1.5} />
            <g transform={`translate(${flipTooltip ? tooltipX - 112 : tooltipX + 8}, ${Math.max(margin.top, tooltipY - 34)})`}>
              <rect x={0} y={0} width={104} height={42} rx={6}
                fill="white" stroke="#e5e7eb" strokeWidth={1}
                className="dark:fill-gray-800 dark:stroke-gray-600"
                style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.12))" }}
              />
              <text x={8} y={15} fontSize={10} className="fill-muted-foreground">{formatX(hovered.label)}</text>
              <text x={8} y={32} fontSize={13} fontWeight={700} fill={hovered.realized >= 0 ? "#22c55e" : "#ef4444"}>
                {hovered.realized >= 0 ? "+" : ""}{formatMoney(hovered.realized)}
              </text>
            </g>
          </g>
        )}
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
            <h1 className="text-3xl font-bold text-foreground">
              Account Summary
            </h1>
            <div className="mt-2 flex items-center gap-3">
              <label
                htmlFor="portfolioFilter"
                className="text-xs text-muted-foreground"
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
              <Link href="/portfolios">View Portfolios</Link>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Section A+B: Overview & Operations */}
      <Card className="rounded-xl">
        <CardContent className="p-6">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Overview & Ops
            </h2>
            <span
              className={`text-xs font-medium ${pctColor(view.accountPercentUsed)}`}
            >{`% Used: ${view.accountPercentUsed.toFixed(1)}%`}</span>
          </div>

          {/* Key figures row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Current Capital
              </p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {formatLongCurrency(view.accountCurrentCapital)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{`Base ${formatLongCurrency(view.accountBase)} (Start ${formatLongCurrency(view.accountStarting)} · Addl ${formatLongCurrency(view.accountAdditional)})`}</p>
              <p className="text-xs text-muted-foreground">{`Realized ${formatCompactCurrency(view.accountProfit)}`}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Capital In Use
              </p>
              <p className="mt-1 text-3xl font-semibold text-amber-600 dark:text-amber-400">
                {formatLongCurrency(view.accountCapitalUsed)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Open Trades
              </p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {view.totalOpenTrades}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Next Expiration
              </p>
              <p className="mt-1 text-base font-medium text-primary">
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
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Expiring ≤ 7 Days
              </p>
              <p className="mt-1 text-3xl font-semibold text-rose-600 dark:text-rose-400">
                {view.totalExpiringSoon}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Win Rate
              </p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {view.winRate != null ? `${view.winRate.toFixed(1)}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Avg Days in Trade
              </p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {view.avgDaysInTrade != null ? view.avgDaysInTrade.toFixed(1) : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section B: Priority Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Top Exposures
              </h2>
              <span className="text-xs text-muted-foreground">{`by % collateral (${selectedPortfolio ? "selected" : "all"})`}</span>
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
                      <span className="text-muted-foreground">
                        {t.pct.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No exposures to display
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Premium by Ticker (realized)
              </h2>
              <span className="text-xs text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">
                No realized premium yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section C: Realized P&L */}
      <Card className="rounded-xl">
        <CardContent className="p-6">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Realized P&L</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Cumulative — hover to inspect</p>
            </div>
            {/* Tab switcher */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {(["mtd", "90d", "ytd"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    activeTab === tab
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "mtd" ? "MTD" : tab === "90d" ? "90D" : "YTD"}
                </button>
              ))}
            </div>
          </div>

          {/* Period stats chips */}
          {(() => {
            const last = timelineSeries[timelineSeries.length - 1]?.realized ?? 0;
            const diffs = timelineSeries.map((pt, i) =>
              i === 0 ? pt.realized : pt.realized - timelineSeries[i - 1].realized,
            );
            const bestPeriod = diffs.length ? Math.max(...diffs) : 0;
            const worstPeriod = diffs.length ? Math.min(...diffs) : 0;
            const periodLabel = activeTab === "ytd" ? "mo" : "day";
            return (
              <div className="flex flex-wrap gap-3 mb-5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">Period Total</span>
                  <span className={`text-base font-bold tabular-nums ${last >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    {last >= 0 ? "+" : ""}{formatCompactCurrency(last)}
                  </span>
                </div>
                <div className="w-px bg-border self-stretch" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">Best {periodLabel}</span>
                  <span className="text-base font-bold tabular-nums text-green-600 dark:text-green-400">
                    {bestPeriod > 0 ? "+" : ""}{formatCompactCurrency(bestPeriod)}
                  </span>
                </div>
                <div className="w-px bg-border self-stretch" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">Worst {periodLabel}</span>
                  <span className="text-base font-bold tabular-nums text-red-500">
                    {formatCompactCurrency(worstPeriod)}
                  </span>
                </div>
                <div className="w-px bg-border self-stretch" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">All-time P&L</span>
                  <span className={`text-base font-bold tabular-nums ${moneyColor(view.accountProfit)}`}>
                    {view.accountProfit >= 0 ? "+" : ""}{formatCompactCurrency(view.accountProfit)}
                  </span>
                </div>
              </div>
            );
          })()}

          <PnLChart data={timelineSeries} height={300} />
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
        <p className="text-sm text-muted-foreground mb-2">
          By portfolio (each chip: Portfolio Name · % Used · Open positions ·
          Expiring ≤7d)
        </p>
        <div className="flex flex-wrap gap-2 bg-card p-2 rounded">
          {agg.perPortfolio.map((pp, i) => (
            <motion.span
              key={pp.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.02 * i }}
              className={`text-xs px-2 py-1 rounded border bg-card ${pctColor(pp.pctUsed)}`}
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
