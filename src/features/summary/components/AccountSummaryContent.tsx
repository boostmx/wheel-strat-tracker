"use client";

import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CreatePortfolioModal } from "@/features/portfolios/components/CreatePortfolioModal";
import { useRouter } from "next/navigation";

const AccountsReportContent = dynamic(
  () =>
    import("@/features/reports/components/AccountReportsContent").then(
      (m) => m.AccountsReportContent,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground py-8 text-center">Loading report…</p>
    ),
  },
);
import { ChevronDown, ChevronUp } from "lucide-react";
import { TypeBadge } from "@/features/trades/components/TypeBadge";

type ExposureEntry = { ticker: string; weightPct: number };
type TickerPremium = { ticker: string; premium: number };
type OpenTradeSummary = {
  id: string;
  ticker: string;
  type: string;
  strikePrice: number;
  contractsOpen: number;
  expirationDate: string;
  contractPrice: number;
  collateral: number;
  portfolioId: string;
  portfolioName: string;
};
type QuoteMap = Record<string, { price: number | null; change: number | null; changePct: number | null; marketState?: string | null }>;

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
  pnlSeriesWeekly52: { label: string; realized: number }[];
  pnlSeriesMonthly12: { label: string; realized: number }[];
  pnlSeriesMonthlyAll: { label: string; realized: number }[];
  pnlSeriesYearly: { label: string; realized: number }[];
  openTradesList: OpenTradeSummary[];
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
  pnlSeriesWeekly52: { label: string; realized: number }[];
  pnlSeriesMonthly12: { label: string; realized: number }[];
  pnlSeriesMonthlyAll: { label: string; realized: number }[];
  pnlSeriesYearly: { label: string; realized: number }[];
  openTrades: OpenTradeSummary[];
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
    <div className="space-y-2.5">
      {typed.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (Math.abs(val) / max) * 100;
        const isNeg = val < 0;
        return (
          <div key={`${String(d[labelKey])}-${i}`} className="w-full">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-foreground text-[12px]">{String(d[labelKey])}</span>
              <span className={`tabular-nums text-[11px] ${isNeg ? "text-red-500" : "text-muted-foreground"}`}>
                {formatCompactCurrency(val)}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: isNeg ? "hsl(0 70% 50%)" : `hsl(${(210 + i * 27) % 360} 65% 48%)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TODAY_MS = (() => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
})();

function dte(expirationDate: string): number {
  const exp = new Date(expirationDate + "T00:00:00Z").getTime();
  return Math.ceil((exp - TODAY_MS) / 86_400_000);
}

function DteBadge({ days }: { days: number }) {
  const cls =
    days <= 7
      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
      : days <= 14
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${cls}`}>
      {days}d
    </span>
  );
}


function OpenPositionsCard({
  trades,
  quotes,
  quotesLoading,
  showPortfolio = false,
}: {
  trades: OpenTradeSummary[];
  quotes: QuoteMap;
  quotesLoading: boolean;
  showPortfolio?: boolean;
}) {
  const router = useRouter();
  const [posTab, setPosTab] = useState<"expiring" | "all">("all");

  const expiringSoon = trades.filter((t) => dte(t.expirationDate) <= 14);
  const displayed = posTab === "expiring" ? expiringSoon : trades;

  const totalOpenPremium = trades.reduce(
    (sum, t) => sum + t.contractsOpen * t.contractPrice * 100,
    0,
  );

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const marketState = Object.values(quotes).find((q) => q.marketState)?.marketState ?? null;
  const marketLabel =
    marketState === "PRE"
      ? "Pre-Market"
      : marketState === "POST" || marketState === "POSTPOST"
        ? "After Hours"
        : marketState != null && marketState !== "REGULAR"
          ? "Last Close"
          : "Live Price";

  return (
    <Card className="rounded-xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-foreground">Open Positions</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{trades.length} active</span>
            {totalOpenPremium > 0 && (
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full tabular-nums">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalOpenPremium)} open premium
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {([["expiring", `Expiring Soon (${expiringSoon.length})`], ["all", "All"]] as const).map(([tab, label]) => (
              <button key={tab} onClick={() => setPosTab(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${posTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {posTab === "expiring" ? "No positions expiring within 14 days" : "No open positions"}
          </p>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="sm:hidden space-y-2">
              {displayed.map((t) => {
                const d = dte(t.expirationDate);
                const q = quotes[t.ticker];
                const price = q?.price ?? null;
                const change = q?.changePct ?? null;
                const isCSP = t.type.toLowerCase().replace(/\s/g, "") === "cashsecuredput" || t.type.toLowerCase() === "csp";
                const isCC = t.type.toLowerCase().replace(/\s/g, "") === "coveredcall" || t.type.toLowerCase() === "cc";
                let otmPct: number | null = null;
                if (price != null) {
                  if (isCSP) otmPct = ((price - t.strikePrice) / price) * 100;
                  else if (isCC) otmPct = ((t.strikePrice - price) / price) * 100;
                }
                const isITM = otmPct != null && otmPct < 0;
                return (
                  <div
                    key={t.id}
                    className="rounded-lg border border-border/50 p-3 space-y-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => router.push(`/portfolios/${t.portfolioId}/trades/${t.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-foreground text-sm">{t.ticker}</span>
                        <TypeBadge type={t.type} />
                        {showPortfolio && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[80px]">
                            {t.portfolioName}
                          </span>
                        )}
                      </div>
                      <DteBadge days={d} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">Strike</p>
                        <p className="text-xs font-medium text-foreground tabular-nums">{formatPrice(t.strikePrice)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">Expiry</p>
                        <p className="text-xs font-medium text-foreground">{t.expirationDate.slice(5).replace("-", "/")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">Open Premium</p>
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(t.contractsOpen * t.contractPrice * 100)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/30 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          Cts: <span className="font-medium text-foreground">{t.contractsOpen}</span>
                        </span>
                        {quotesLoading && !price ? (
                          <span className="text-muted-foreground">—</span>
                        ) : price != null ? (
                          <span className="text-muted-foreground">
                            {marketLabel}: <span className="font-medium text-foreground tabular-nums">{formatPrice(price)}</span>
                            {change != null && (
                              <span className={`ml-1 tabular-nums font-medium ${change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                                {change >= 0 ? "▲" : "▼"}{Math.abs(change).toFixed(2)}%
                              </span>
                            )}
                          </span>
                        ) : null}
                      </div>
                      {otmPct != null ? (
                        <span className={`font-semibold tabular-nums ${isITM ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {isITM ? "ITM " : ""}{Math.abs(otmPct).toFixed(1)}%{!isITM ? " OTM" : ""}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Ticker", "Type", "Strike", "Expiry", "Contracts", "Open Premium", marketLabel, "OTM %"].map((h) => (
                      <th key={h} className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide pb-2 pr-4 last:pr-0 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((t) => {
                    const d = dte(t.expirationDate);
                    const q = quotes[t.ticker];
                    const price = q?.price ?? null;
                    const change = q?.changePct ?? null;
                    const isCSP = t.type.toLowerCase().replace(/\s/g, "") === "cashsecuredput" || t.type.toLowerCase() === "csp";
                    const isCC = t.type.toLowerCase().replace(/\s/g, "") === "coveredcall" || t.type.toLowerCase() === "cc";
                    let otmPct: number | null = null;
                    if (price != null) {
                      if (isCSP) otmPct = ((price - t.strikePrice) / price) * 100;
                      else if (isCC) otmPct = ((t.strikePrice - price) / price) * 100;
                    }
                    const isITM = otmPct != null && otmPct < 0;
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-border/30 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => router.push(`/portfolios/${t.portfolioId}/trades/${t.id}`)}
                      >
                        <td className="py-2.5 pr-4">
                          <span className="font-semibold text-foreground">{t.ticker}</span>
                          {showPortfolio && (
                            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.portfolioName}</div>
                          )}
                        </td>
                        <td className="py-2.5 pr-4"><TypeBadge type={t.type} /></td>
                        <td className="py-2.5 pr-4 tabular-nums text-foreground">{formatPrice(t.strikePrice)}</td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground tabular-nums">{t.expirationDate.slice(5).replace("-", "/")}</span>
                            <DteBadge days={d} />
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 tabular-nums text-foreground">{t.contractsOpen}</td>
                        <td className="py-2.5 pr-4 tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(t.contractsOpen * t.contractPrice * 100)}
                        </td>
                        <td className="py-2.5 pr-4">
                          {quotesLoading && !price ? (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          ) : price != null ? (
                            <div className="flex flex-col">
                              <span className="tabular-nums font-medium text-foreground text-xs">{formatPrice(price)}</span>
                              {change != null && (
                                <span className={`text-[10px] tabular-nums font-medium ${change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                                  {change >= 0 ? "▲" : "▼"}{Math.abs(change).toFixed(2)}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">n/a</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          {otmPct != null ? (
                            <span className={`text-xs font-semibold tabular-nums ${isITM ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {isITM ? "ITM " : ""}{Math.abs(otmPct).toFixed(1)}%{!isITM ? " OTM" : ""}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AccountSummaryContent({
  portfolioId,
  embedded,
}: {
  portfolioId?: string;
  embedded?: boolean;
} = {}) {
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

  const selectedPortfolioId = portfolioId ?? "all";
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

  const chartWeekly52Series = useMemo(() => {
    return selectedPortfolio
      ? selectedPortfolio.pnlSeriesWeekly52
      : (data?.pnlSeriesWeekly52 ?? []);
  }, [selectedPortfolio, data]);

  const chartMonthly12Series = useMemo(() => {
    return selectedPortfolio
      ? selectedPortfolio.pnlSeriesMonthly12
      : (data?.pnlSeriesMonthly12 ?? []);
  }, [selectedPortfolio, data]);

  const chartMonthlyAllSeries = useMemo(() => {
    return selectedPortfolio
      ? selectedPortfolio.pnlSeriesMonthlyAll
      : (data?.pnlSeriesMonthlyAll ?? []);
  }, [selectedPortfolio, data]);

  const chartYearlySeries = useMemo(() => {
    return selectedPortfolio
      ? selectedPortfolio.pnlSeriesYearly
      : (data?.pnlSeriesYearly ?? []);
  }, [selectedPortfolio, data]);

  const [accountTab, setAccountTab] = useState<"Overview" | "Report">("Overview");
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "monthly" | "yearly" | "ytd" | "alltime">("daily");
  const [dailyWindow, setDailyWindow] = useState<"mtd" | "30d" | "90d">("mtd");
  const [showAllPremium, setShowAllPremium] = useState(false);

  // Open trades scoped to selected portfolio
  const openTrades = useMemo<OpenTradeSummary[]>(() => {
    if (!data) return [];
    const list = selectedPortfolio
      ? selectedPortfolio.openTradesList
      : (data.openTrades ?? []);
    return [...list].sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
  }, [data, selectedPortfolio]);

  // Unique tickers for live quote fetching
  const quoteTickers = useMemo(
    () => [...new Set(openTrades.map((t) => t.ticker))].join(","),
    [openTrades],
  );

  const { data: quotesData, isLoading: quotesLoading } = useSWR<QuoteMap>(
    quoteTickers ? `/api/quotes?tickers=${quoteTickers}` : null,
    { refreshInterval: 60_000 },
  );
  const quotes: QuoteMap = quotesData ?? {};

  const timelineSeries = useMemo(() => {
    const toPerPeriod = (s: { label: string; realized: number }[]) =>
      s.map((d, i) => ({
        label: d.label,
        value: i === 0 ? d.realized : d.realized - s[i - 1].realized,
      }));

    if (activeTab === "daily") {
      const all = toPerPeriod(chartDaily90Series);
      if (dailyWindow === "mtd") {
        const now = new Date();
        const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const filtered = all.filter((d) => d.label.startsWith(prefix));
        return filtered.length > 0 ? filtered : all;
      }
      if (dailyWindow === "30d") return all.slice(-30);
      return all; // "90d"
    }
    if (activeTab === "weekly") return toPerPeriod(chartWeekly52Series);
    if (activeTab === "monthly") return toPerPeriod(chartMonthly12Series);
    if (activeTab === "yearly") return toPerPeriod(chartYearlySeries);
    if (activeTab === "ytd") return toPerPeriod(chartYtdSeries);
    if (activeTab === "alltime") return toPerPeriod(chartMonthlyAllSeries);
    return toPerPeriod(chartDaily90Series);
  }, [activeTab, dailyWindow, chartDaily90Series, chartWeekly52Series, chartMonthly12Series, chartYearlySeries, chartYtdSeries, chartMonthlyAllSeries]);

  if (isLoading) {
    return <div className="py-16 px-4 sm:px-6">Loading...</div>;
  }
  if (error) {
    return (
      <div className="py-16 px-4 sm:px-6 text-red-600">
        Failed to load portfolios.
      </div>
    );
  }

  // Empty state: no portfolios
  const hasNoPortfolios =
    data && Object.keys(data.perPortfolio || {}).length === 0;
  if (hasNoPortfolios) {
    return (
      <div className="py-16 sm:py-24 px-4 sm:px-6 text-center">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome!
        </h1>
        <p className="mt-3 text-muted-foreground">
          You don&apos;t have any portfolios yet. Create your first portfolio to
          start tracking trades and premiums and see your account summary here.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <CreatePortfolioModal
            trigger={
              <Button variant="default" size="lg">
                Create Portfolio
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  function PnLChart({
    data,
    height = 280,
  }: {
    data: { label: string; value: number }[];
    height?: number;
  }) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    if (!data || data.length === 0)
      return <div className="text-xs text-muted-foreground py-8 text-center">No data for this period</div>;

    const bars = data;

    const margin = { top: 16, right: 16, bottom: 32, left: 58 };
    const W = 600;
    const H = height;
    const iW = W - margin.left - margin.right;
    const iH = H - margin.top - margin.bottom;

    const ys = bars.map((b) => b.value);
    const rawMin = Math.min(0, ...ys);
    const rawMax = Math.max(0, ...ys);
    const pad = (rawMax - rawMin) * 0.12 || 10;
    const yMin = rawMin - pad;
    const yMax = rawMax + pad;
    const yRange = Math.max(1, yMax - yMin);

    const yScale = (v: number) => margin.top + iH - ((v - yMin) * iH) / yRange;
    const zeroY = yScale(0);

    const totalBars = bars.length;
    const barGap = Math.max(1, Math.min(4, Math.round(iW / totalBars * 0.15)));
    const barW = Math.max(2, (iW - barGap * (totalBars - 1)) / totalBars);
    const barX = (i: number) => margin.left + i * (barW + barGap);

    const yGridVals = Array.from({ length: 5 }, (_, i) => rawMin + ((rawMax - rawMin) / 4) * i);
    if (!yGridVals.includes(0) && rawMin < 0 && rawMax > 0) yGridVals.push(0);

    const maxLabels = Math.min(8, bars.length);
    const xIdxs = Array.from({ length: maxLabels }, (_, i) =>
      Math.round((i * (bars.length - 1)) / Math.max(1, maxLabels - 1)),
    );

    const formatMoney = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);

    const formatX = (s: string) => {
      if (s.length === 10) return `${s.slice(5, 7)}/${s.slice(8, 10)}`; // YYYY-MM-DD → MM/DD
      if (s.length === 7) return `${s.slice(5)}/${s.slice(2, 4)}`; // YYYY-MM → MM/YY
      return s; // YYYY (yearly) → as-is
    };

    const hovered = hoveredIdx !== null ? bars[hoveredIdx] : null;
    const tooltipBx = hoveredIdx !== null ? barX(hoveredIdx) + barW / 2 : 0;
    const tooltipBy = hovered ? (hovered.value >= 0 ? yScale(hovered.value) : zeroY) : 0;
    const flipTooltip = tooltipBx > W * 0.65;

    return (
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible cursor-crosshair"
        onMouseMove={(e) => {
          const ctm = e.currentTarget.getScreenCTM();
          if (!ctm) return;
          const pt = (e.currentTarget as SVGSVGElement).createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const mx = pt.matrixTransform(ctm.inverse()).x - margin.left;
          const idx = Math.floor(mx / (barW + barGap));
          setHoveredIdx(Math.max(0, Math.min(bars.length - 1, idx)));
        }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
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

        {/* Bars */}
        {bars.map((b, i) => {
          const isPos = b.value >= 0;
          const barTop = isPos ? yScale(b.value) : zeroY;
          const barHeight = Math.abs(yScale(b.value) - zeroY);
          const isHovered = hoveredIdx === i;
          return (
            <rect
              key={i}
              x={barX(i)}
              y={barTop}
              width={barW}
              height={Math.max(1, barHeight)}
              rx={Math.min(2, barW * 0.15)}
              fill={isPos ? (isHovered ? "#16a34a" : "#22c55e") : (isHovered ? "#dc2626" : "#ef4444")}
              opacity={hoveredIdx !== null && !isHovered ? 0.45 : 1}
            />
          );
        })}

        {/* X labels */}
        {xIdxs.map((idx) => (
          <text key={idx} x={barX(idx) + barW / 2} y={margin.top + iH + 20} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
            {formatX(bars[idx].label)}
          </text>
        ))}

        {/* Hover tooltip */}
        {hovered && hoveredIdx !== null && (
          <g>
            <g transform={`translate(${flipTooltip ? tooltipBx - 116 : tooltipBx + 8}, ${Math.max(margin.top, tooltipBy - 44)})`}>
              <rect x={0} y={0} width={108} height={42} rx={6}
                fill="white" stroke="#e5e7eb" strokeWidth={1}
                className="dark:fill-gray-800 dark:stroke-gray-600"
                style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.12))" }}
              />
              <text x={8} y={15} fontSize={10} className="fill-muted-foreground">{formatX(hovered.label)}</text>
              <text x={8} y={32} fontSize={13} fontWeight={700} fill={hovered.value >= 0 ? "#22c55e" : "#ef4444"}>
                {hovered.value >= 0 ? "+" : ""}{formatMoney(hovered.value)}
              </text>
            </g>
          </g>
        )}
      </svg>
    );
  }

  const pnlStats = (() => {
    const values = timelineSeries.map((pt) => pt.value);
    const last = values.reduce((a, b) => a + b, 0);
    const best = values.length ? Math.max(...values) : 0;
    const worst = values.length ? Math.min(...values) : 0;
    const periodLabel = activeTab === "weekly" ? "wk" : activeTab === "monthly" || activeTab === "ytd" || activeTab === "alltime" ? "mo" : activeTab === "yearly" ? "yr" : "day";
    return { last, best, worst, periodLabel };
  })();

  return (
    <div className={embedded ? "space-y-5" : "py-6 sm:py-8 px-4 sm:px-6 space-y-5"}>

      {/* ── Header — hidden when embedded in portfolio detail ── */}
      {!embedded && (
        <motion.div
          className="flex items-center justify-between gap-4 flex-wrap"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          style={{ willChange: "opacity, transform" }}
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">All Accounts</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              All portfolios · as of today
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Account-level tab switcher (standalone page only) ── */}
      {!embedded && (
        <>
          <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
            {(["Overview", "Report"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setAccountTab(tab)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                  accountTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          {accountTab === "Report" && (
            <div className="rounded-xl border border-border bg-card overflow-hidden p-5 sm:p-6">
              <AccountsReportContent embedded />
            </div>
          )}
        </>
      )}

      <div className={cn("space-y-5", !embedded && accountTab !== "Overview" && "hidden")}>

      {/* ── KPI Strip ── */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.06 }}
        style={{ willChange: "opacity, transform" }}
      >
        {/* Current Capital */}
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Current Capital</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{formatLongCurrency(view.accountCurrentCapital)}</p>
          <p className="text-[11px] text-muted-foreground">Base {formatCompactCurrency(view.accountBase)}</p>
        </div>

        {/* Total P&L */}
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Total P&L</p>
          <p className={`text-xl font-bold tabular-nums ${moneyColor(view.accountProfit)}`}>
            {view.accountProfit >= 0 ? "+" : ""}{formatCompactCurrency(view.accountProfit)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            MTD {view.totalRealizedMTD >= 0 ? "+" : ""}{formatCompactCurrency(view.totalRealizedMTD)}
          </p>
        </div>

        {/* Cash Available */}
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Cash Available</p>
          <p className={`text-xl font-bold tabular-nums ${view.accountCashAvailable < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            {formatLongCurrency(view.accountCashAvailable)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            In use {formatCompactCurrency(view.accountCapitalUsed)}
          </p>
        </div>

        {/* % Deployed */}
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Deployed</p>
          <p className={`text-xl font-bold tabular-nums ${pctColor(view.accountPercentUsed)}`}>
            {view.accountPercentUsed.toFixed(1)}%
          </p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
            <div
              className={`h-full rounded-full ${
                view.accountPercentUsed >= 85 ? "bg-red-500" : view.accountPercentUsed >= 60 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(view.accountPercentUsed, 100)}%` }}
            />
          </div>
        </div>

        {/* Open Trades */}
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Open Trades</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{view.totalOpenTrades}</p>
          {view.totalExpiringSoon > 0 && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
              {view.totalExpiringSoon} expiring ≤7d
            </p>
          )}
          {view.totalExpiringSoon === 0 && (
            <p className="text-[11px] text-muted-foreground">None expiring soon</p>
          )}
        </div>
      </motion.div>

      {/* ── Activity strip ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.1 }}
        style={{ willChange: "opacity, transform" }}
      >
        <Card className="rounded-xl">
          <CardContent className="px-5 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4">
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Win Rate</p>
                <p className={`text-xl font-bold tabular-nums ${view.winRate != null && view.winRate > 0 ? "text-emerald-600 dark:text-emerald-400" : view.winRate != null ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                  {view.winRate != null ? `${view.winRate.toFixed(1)}%` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">of closed trades</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Avg Hold</p>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {view.avgDaysInTrade != null ? `${view.avgDaysInTrade.toFixed(1)}d` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">per trade</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Realized YTD</p>
                <p className={`text-xl font-bold tabular-nums ${moneyColor(view.totalRealizedYTD)}`}>
                  {view.totalRealizedYTD >= 0 ? "+" : ""}{formatCompactCurrency(view.totalRealizedYTD)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  MTD {view.totalRealizedMTD >= 0 ? "+" : ""}{formatCompactCurrency(view.totalRealizedMTD)}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Expiring ≤7d</p>
                <p className={`text-xl font-bold tabular-nums ${view.totalExpiringSoon > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
                  {view.totalExpiringSoon}
                </p>
                <p className="text-[10px] text-muted-foreground">contracts</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Next Expiry</p>
                <p className="text-sm font-semibold text-primary leading-tight mt-0.5">
                  {view.nextExpiration
                    ? `${view.nextExpiration.topTicker ? view.nextExpiration.topTicker + " · " : ""}${formatDateOnlyUTC(view.nextExpiration.date)}`
                    : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {view.nextExpiration ? `${view.nextExpiration.contracts}c` : "no upcoming"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Middle row: Open Positions (2/3) + Exposures & Premium stacked (1/3) ── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.14 }}
        style={{ willChange: "opacity, transform" }}
      >
        {/* Open Positions — takes 2 of 3 columns */}
        <div className="lg:col-span-2">
          <OpenPositionsCard
            trades={openTrades}
            quotes={quotes}
            quotesLoading={quotesLoading}
            showPortfolio={!selectedPortfolio}
          />
        </div>

        {/* Right panel: Exposures on top, Premium below */}
        <div className="flex flex-col gap-4">
          {/* Top Exposures */}
          <Card className="rounded-xl flex-1">
            <CardContent className="p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Top Exposures</h2>
                <span className="text-[11px] text-muted-foreground">by collateral</span>
              </div>
              {chartExposures.length ? (
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <DonutChart
                      data={chartExposures.map((t) => ({ label: t.ticker, value: t.pct }))}
                      size={90}
                    />
                  </div>
                  <ul className="flex-1 min-w-0 space-y-1.5">
                    {chartExposures.map((t, idx) => (
                      <li key={t.ticker} className="flex items-center gap-1.5 min-w-0">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: `hsl(${(200 + idx * 35) % 360} 70% 50%)` }} />
                        <span className="text-[11px] font-medium text-foreground w-9 truncate">{t.ticker}</span>
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-1 rounded-full" style={{ width: `${t.pct.toFixed(0)}%`, backgroundColor: `hsl(${(200 + idx * 35) % 360} 70% 50%)` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{t.pct.toFixed(0)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No open CSP positions</p>
              )}
            </CardContent>
          </Card>

          {/* Premium by Ticker */}
          <Card className="rounded-xl flex-1">
            <CardContent className="p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Premium by Ticker</h2>
                <span className="text-[11px] text-muted-foreground">realized</span>
              </div>
              {chartPremiumByTicker.length ? (
                <>
                  <HorizontalBars
                    data={(showAllPremium ? chartPremiumByTicker : chartPremiumByTicker.slice(0, 5)).map(
                      (p) => ({ label: p.ticker, value: p.premium }),
                    )}
                  />
                  {chartPremiumByTicker.length > 5 && (
                    <button
                      onClick={() => setShowAllPremium((v) => !v)}
                      className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showAllPremium ? (
                        <><ChevronUp className="h-3 w-3" /> Show less</>
                      ) : (
                        <><ChevronDown className="h-3 w-3" /> All {chartPremiumByTicker.length} tickers</>
                      )}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No realized premium yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* ── P&L Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.18 }}
        style={{ willChange: "opacity, transform" }}
      >
        <Card className="rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Realized P&L</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Per period — hover to inspect</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {activeTab === "daily" && (
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    {(["mtd", "30d", "90d"] as const).map((w) => (
                      <button
                        key={w}
                        onClick={() => setDailyWindow(w)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                          dailyWindow === w
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {w === "mtd" ? "MTD" : w}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-wrap">
                  {(["daily", "weekly", "monthly", "yearly", "ytd", "alltime"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        activeTab === tab
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab === "daily" ? "Daily" : tab === "weekly" ? "Weekly" : tab === "monthly" ? "Monthly" : tab === "yearly" ? "Yearly" : tab === "ytd" ? "YTD" : "All Time"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-5 pb-4 border-b border-border/50">
              <div>
                <p className="text-[11px] text-muted-foreground">Period Total</p>
                <p className={`text-lg font-bold tabular-nums ${pnlStats.last >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                  {pnlStats.last >= 0 ? "+" : ""}{formatCompactCurrency(pnlStats.last)}
                </p>
              </div>
              <div className="hidden sm:block w-px bg-border" />
              <div>
                <p className="text-[11px] text-muted-foreground">Best {pnlStats.periodLabel}</p>
                <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {pnlStats.best > 0 ? "+" : ""}{formatCompactCurrency(pnlStats.best)}
                </p>
              </div>
              <div className="hidden sm:block w-px bg-border" />
              <div>
                <p className="text-[11px] text-muted-foreground">Worst {pnlStats.periodLabel}</p>
                <p className="text-lg font-bold tabular-nums text-red-500">
                  {formatCompactCurrency(pnlStats.worst)}
                </p>
              </div>
              <div className="hidden sm:block w-px bg-border" />
              <div>
                <p className="text-[11px] text-muted-foreground">All-time P&L</p>
                <p className={`text-lg font-bold tabular-nums ${moneyColor(view.accountProfit)}`}>
                  {view.accountProfit >= 0 ? "+" : ""}{formatCompactCurrency(view.accountProfit)}
                </p>
              </div>
            </div>

            <PnLChart data={timelineSeries} height={280} />
          </CardContent>
        </Card>
      </motion.div>

      </div>{/* end overview wrapper */}
    </div>
  );
}
