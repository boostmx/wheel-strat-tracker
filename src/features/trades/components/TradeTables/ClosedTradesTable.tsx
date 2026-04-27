"use client";

import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { TypeBadge } from "@/features/trades/components/TypeBadge";
import { useRouter } from "next/navigation";
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import type { ClosedHistoryItem, ClosedHistoryResponse } from "@/app/api/portfolios/[id]/closed-history/route";

type Timeframe = "week" | "month" | "year" | "all";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const toNumber = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const plClass = (n: number) =>
  n > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : n < 0
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";

const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);


function getDateRange(tf: Timeframe): { dateFrom: string | null; dateTo: string | null } {
  const now = new Date();
  const dateTo = now.toISOString();
  if (tf === "all") return { dateFrom: null, dateTo: null };
  const from = new Date(now);
  if (tf === "week") from.setDate(from.getDate() - 7);
  if (tf === "month") from.setMonth(from.getMonth() - 1);
  if (tf === "year") from.setFullYear(from.getFullYear() - 1);
  return { dateFrom: from.toISOString(), dateTo };
}

function computeTradePercentPL(item: Extract<ClosedHistoryItem, { kind: "trade" }>): number | null {
  if (item.percentPL != null) return item.percentPL;
  const cp = item.contractPrice;
  const ci = item.contractsInitial;
  const pc = item.premiumCaptured;
  if (pc != null && cp > 0 && ci > 0) {
    const denom = cp * ci * 100;
    if (denom > 0) return (pc / denom) * 100;
  }
  return null;
}

function computeStockPercentPL(item: Extract<ClosedHistoryItem, { kind: "stock" }>): number | null {
  const pnl = item.realizedPnl;
  const basis = item.avgCost * item.shares;
  if (pnl == null || basis <= 0) return null;
  return (pnl / basis) * 100;
}

export function ClosedTradesTable({ portfolioId }: { portfolioId: string }) {
  const router = useRouter();
  const [timeframe, setTimeframe] = useState<Timeframe>("month");
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);

  // Reset to first page when filters or page size change
  useEffect(() => { setPageIndex(0); }, [timeframe, pageSize]);

  const { dateFrom, dateTo } = useMemo(() => getDateRange(timeframe), [timeframe]);

  const skip = pageIndex * pageSize;
  const swrKey = useMemo(() => {
    const params = new URLSearchParams({ take: String(pageSize), skip: String(skip) });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return `/api/portfolios/${portfolioId}/closed-history?${params}`;
  }, [portfolioId, pageSize, skip, dateFrom, dateTo]);

  const { data, isLoading } = useSWR<ClosedHistoryResponse>(swrKey, fetcher);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const metrics = {
    count: total,
    totalPremium: data?.totalPremium ?? null,
    avgPercentPL: data?.avgPercentPL ?? null,
  };

  const plBadgeClass = (n: number) =>
    n >= 0
      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
      : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40";

  const timeframeTabs = [
    ["week", "7D"],
    ["month", "30D"],
    ["year", "1Y"],
    ["all", "All"],
  ] as const;

  return (
    <div className="w-full">
      {/* Shared header — stacks on mobile, inline on desktop */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Title + stat badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-foreground">Closed Activity</h2>
          {!isLoading && metrics.count > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {metrics.count} closed
            </span>
          )}
          {metrics.totalPremium != null && metrics.count > 0 && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full tabular-nums ${plBadgeClass(metrics.totalPremium)}`}>
              {metrics.totalPremium >= 0 ? "+" : ""}{formatUSD(metrics.totalPremium)} P/L
            </span>
          )}
          {metrics.avgPercentPL != null && metrics.count > 0 && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full tabular-nums ${plBadgeClass(metrics.avgPercentPL)}`}>
              {metrics.avgPercentPL >= 0 ? "+" : ""}{Number(metrics.avgPercentPL).toFixed(1)}% avg
            </span>
          )}
        </div>

        {/* Controls: timeframe tabs + rows select */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {timeframeTabs.map(([tf, label]) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  timeframe === tf
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No closed trades yet.</div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {items.map((item) => {
                const isStock = item.kind === "stock";
                const pnl = isStock
                  ? toNumber((item as Extract<ClosedHistoryItem, { kind: "stock" }>).realizedPnl)
                  : toNumber((item as Extract<ClosedHistoryItem, { kind: "trade" }>).premiumCaptured);
                const pct = isStock
                  ? computeStockPercentPL(item as Extract<ClosedHistoryItem, { kind: "stock" }>)
                  : computeTradePercentPL(item as Extract<ClosedHistoryItem, { kind: "trade" }>);
                const closedDate = new Date(item.closedAt);
                const href = isStock
                  ? `/portfolios/${portfolioId}/stocks/${item.id}`
                  : `/portfolios/${portfolioId}/trades/${item.id}`;

                return (
                  <button key={`${item.kind}-${item.id}`} onClick={() => router.push(href)}
                    className="w-full text-left rounded-xl border p-3 bg-card hover:bg-accent transition">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{item.ticker}</div>
                      {isStock
                        ? <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-muted text-muted-foreground">Shares</span>
                        : <TypeBadge type={(item as Extract<ClosedHistoryItem, { kind: "trade" }>).type} />}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Closed</div>
                        <div>{formatDateOnlyUTC(closedDate)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">P/L</div>
                        <div className={`font-medium ${plClass(pnl)}`}>{formatUSD(pnl)}</div>
                        {pct != null && <div className={`text-xs ${plClass(pct)}`}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</div>}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{isStock ? "Avg Cost" : "Strike"}</div>
                        <div className="tabular-nums">
                          {isStock
                            ? formatUSD(toNumber((item as Extract<ClosedHistoryItem, { kind: "stock" }>).avgCost))
                            : formatUSD((item as Extract<ClosedHistoryItem, { kind: "trade" }>).strikePrice)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{isStock ? "Shares" : "Contracts"}</div>
                        <div>{isStock
                          ? (item as Extract<ClosedHistoryItem, { kind: "stock" }>).shares
                          : (item as Extract<ClosedHistoryItem, { kind: "trade" }>).contractsInitial}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="min-w-full text-sm text-left text-foreground">
                <thead className="border-b border-border/60">
                  <tr>
                    {["Ticker", "Type", "Strike / Cost", "Qty", "P/L", "Closed"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isStock = item.kind === "stock";
                    const trade = item as Extract<ClosedHistoryItem, { kind: "trade" }>;
                    const stock = item as Extract<ClosedHistoryItem, { kind: "stock" }>;
                    const pnl = isStock ? toNumber(stock.realizedPnl) : toNumber(trade.premiumCaptured);
                    const pct = isStock ? computeStockPercentPL(stock) : computeTradePercentPL(trade);
                    const closedDate = new Date(item.closedAt);
                    const href = isStock
                      ? `/portfolios/${portfolioId}/stocks/${item.id}`
                      : `/portfolios/${portfolioId}/trades/${item.id}`;

                    return (
                      <tr key={`${item.kind}-${item.id}`}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => router.push(href)}>
                        <td className="px-4 py-2"><span className="font-semibold">{item.ticker}</span></td>
                        <td className="px-4 py-2">
                          {isStock
                            ? <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-muted text-muted-foreground">Shares</span>
                            : <TypeBadge type={trade.type} />}
                        </td>
                        <td className="px-4 py-2 tabular-nums">
                          {isStock
                            ? <div><div>{formatUSD(stock.avgCost)}</div><div className="text-xs text-muted-foreground">avg cost</div></div>
                            : formatUSD(trade.strikePrice)}
                        </td>
                        <td className="px-4 py-2">
                          {isStock
                            ? <div><div>{stock.shares}</div><div className="text-xs text-muted-foreground">shares</div></div>
                            : <div><div>{trade.contractsInitial}</div><div className="text-xs text-muted-foreground">contract{trade.contractsInitial === 1 ? "" : "s"}</div></div>}
                        </td>
                        <td className="px-4 py-2">
                          <div className={`tabular-nums font-medium ${plClass(pnl)}`}>{formatUSD(pnl)}</div>
                          {pct != null && <div className={`text-xs tabular-nums ${plClass(pct)}`}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</div>}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground tabular-nums">{formatDateOnlyUTC(closedDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Pagination footer */}
      {pageCount > 1 && (
        <div className="mt-3 px-4 pb-4 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Page {Math.min(pageIndex + 1, pageCount)} of {pageCount} • {total} result{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPageIndex(0)} disabled={pageIndex === 0 || isLoading}>
              <ChevronLeft className="h-3 w-3" /><ChevronLeft className="h-3 w-3 -ml-2" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={pageIndex === 0 || isLoading}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))} disabled={pageIndex >= pageCount - 1 || isLoading}>
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPageIndex(pageCount - 1)} disabled={pageIndex >= pageCount - 1 || isLoading}>
              <ChevronRight className="h-3 w-3" /><ChevronRight className="h-3 w-3 -ml-2" />
            </Button>
          </div>
        </div>
      )}
      {pageCount <= 1 && total > 0 && (
        <div className="mt-1 px-4 pb-4">
          <span className="text-xs text-muted-foreground">{total} result{total === 1 ? "" : "s"}</span>
        </div>
      )}
    </div>
  );
}
