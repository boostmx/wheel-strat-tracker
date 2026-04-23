"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { format, startOfDay, endOfDay, isAfter } from "date-fns";
import type { Trade } from "@/types";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Download, TrendingUp, TrendingDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TypeBadge } from "@/features/trades/components/TypeBadge";
import { cn } from "@/lib/utils";

type PortfolioBasic = { id: string; name: string };
const fetchPortfolios = async (): Promise<PortfolioBasic[]> => {
  const res = await fetch("/api/portfolios", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed ${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data) ? data : Array.isArray(data.rows) ? data.rows : [];
  return rows.map((p: { id: string; name?: string }) => ({ id: p.id, name: p.name ?? p.id }));
};

type ReportRow = Trade & {
  portfolioName: string;
  premiumReceived: number;
  premiumPaidToClose: number;
  premiumCapturedComputed: number;
  pctPLOnPremium: number;
  holdingDays: number;
  contractsClosed: number;
  sharesClosed: number;
  totalPL: number;
  investedCapital: number;
  pctPLOnTotal: number;
  stockExitPrice?: number;
  realizedPnl?: number | null;
  closeReason?: string;
};

type ReportsApiResponse = {
  range: { start: string; end: string };
  count: number;
  rows: ReportRow[];
};

const fetcher = async (url: string): Promise<ReportsApiResponse> => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed ${res.status}`);
  return res.json() as Promise<ReportsApiResponse>;
};

function calcTotalPL(r: ReportRow): number {
  return typeof r.totalPL === "number" && Number.isFinite(r.totalPL)
    ? r.totalPL
    : typeof r.premiumCaptured === "number" ? r.premiumCaptured : 0;
}

function calcPctReturn(r: ReportRow): number {
  if (typeof r.pctPLOnTotal === "number" && Number.isFinite(r.pctPLOnTotal)) return r.pctPLOnTotal;
  if (typeof r.percentPL === "number" && Number.isFinite(r.percentPL)) {
    const v = r.percentPL;
    return Math.abs(v) > 1 ? v / 100 : v;
  }
  return 0;
}

function fmtDateCompact(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d");
}

function fmtUSD(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtUSDExact(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

const CLOSE_REASON_LABELS: Record<string, string> = {
  expiredWorthless: "Expired",
  assigned: "Assigned",
  manual: "Manual",
};

function CloseReasonBadge({ reason }: { reason?: string }) {
  if (!reason) return <span className="text-muted-foreground">—</span>;
  const label = CLOSE_REASON_LABELS[reason] ?? reason;
  const cls =
    reason === "expiredWorthless"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : reason === "assigned"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function PLCell({ value, pct }: { value: number; pct: number }) {
  const pos = value >= 0;
  return (
    <div>
      <span className={`font-semibold tabular-nums ${pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
        {pos ? "+" : ""}{fmtUSD(value)}
      </span>
      <div className={`text-[11px] tabular-nums ${pos ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-red-400/70"}`}>
        {(pct * 100).toFixed(1)}%
      </div>
    </div>
  );
}

// ── Stats summary ───────────────────────────────────────────────────────
function Stats({ rows }: { rows: ReportRow[] }) {
  const totalPL = rows.reduce((s, r) => s + calcTotalPL(r), 0);
  const wins = rows.filter((r) => calcTotalPL(r) > 0);
  const losses = rows.filter((r) => calcTotalPL(r) < 0);
  const winRate = rows.length > 0 ? wins.length / rows.length : null;
  const avgPct = rows.length > 0
    ? rows.reduce((s, r) => s + calcPctReturn(r), 0) / rows.length
    : 0;
  const plValues = rows.map((r) => calcTotalPL(r));
  const best = plValues.length > 0 ? Math.max(...plValues) : null;
  const worst = plValues.length > 0 ? Math.min(...plValues) : null;
  const holdDays = rows
    .map((r) => (typeof r.holdingDays === "number" && r.holdingDays >= 0 ? r.holdingDays : null))
    .filter((d): d is number => d !== null);
  const avgHold = holdDays.length > 0 ? holdDays.reduce((s, d) => s + d, 0) / holdDays.length : null;

  const reasonCounts = rows.reduce<Record<string, { count: number; pl: number }>>((acc, r) => {
    const reason = r.closeReason ?? "manual";
    if (!acc[reason]) acc[reason] = { count: 0, pl: 0 };
    acc[reason].count += 1;
    acc[reason].pl += calcTotalPL(r);
    return acc;
  }, {});

  const plPos = totalPL >= 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total P/L */}
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Total P/L</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${plPos ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
            {plPos ? "+" : ""}{fmtUSD(totalPL)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{rows.length} trade{rows.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Win Rate */}
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Win Rate</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${winRate != null && winRate > 0 ? "text-emerald-600 dark:text-emerald-400" : winRate != null ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
            {winRate != null ? `${(winRate * 100).toFixed(0)}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {wins.length}W · {losses.length}L
          </p>
        </div>

        {/* Avg Return */}
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Avg Return</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${avgPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
            {avgPct >= 0 ? "+" : ""}{(avgPct * 100).toFixed(1)}%
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">per position</p>
        </div>

        {/* Avg Hold */}
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Avg Hold</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {avgHold != null ? `${avgHold.toFixed(1)}d` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">days in trade</p>
        </div>
      </div>

      {/* Secondary row */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-1 text-xs text-muted-foreground">
        {best != null && (
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            Best <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmtUSDExact(best)}</span>
          </span>
        )}
        {worst != null && (
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-red-400" />
            Worst <span className={`font-medium ${worst < 0 ? "text-red-500 dark:text-red-400" : "text-foreground"}`}>{fmtUSDExact(worst)}</span>
          </span>
        )}
        {Object.entries(reasonCounts).map(([reason, { count, pl }]) => (
          <span key={reason}>
            {CLOSE_REASON_LABELS[reason] ?? reason}{" "}
            <span className="font-medium text-foreground">{count}</span>
            <span className="mx-0.5 opacity-40">·</span>
            <span className={pl >= 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-red-500"}>
              {pl >= 0 ? "+" : ""}{fmtUSD(pl)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main table ──────────────────────────────────────────────────────────
function ReportTable({
  rows,
  csvHref,
  showPortfolio,
  selectedTicker,
  setSelectedTicker,
  tickers,
  selectedType,
  setSelectedType,
  types,
  selectedCloseReason,
  setSelectedCloseReason,
}: {
  rows: ReportRow[];
  csvHref: string;
  showPortfolio: boolean;
  selectedTicker: string;
  setSelectedTicker: (t: string) => void;
  tickers: string[];
  selectedType: string;
  setSelectedType: (t: string) => void;
  types: string[];
  selectedCloseReason: string;
  setSelectedCloseReason: (r: string) => void;
}) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(b.closedAt ?? b.createdAt).getTime() - new Date(a.closedAt ?? a.createdAt).getTime()),
    [rows],
  );

  const selectCls = "border border-input bg-background text-foreground rounded-md px-2 py-1 text-sm w-full sm:w-auto";

  return (
    <div className="space-y-3">
      {/* Filter + Export row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select className={selectCls} value={selectedType} onChange={(e) => setSelectedType(e.target.value)} disabled={types.length === 0}>
            <option value="all">All types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={selectCls} value={selectedTicker} onChange={(e) => setSelectedTicker(e.target.value)} disabled={tickers.length === 0}>
            <option value="all">All tickers</option>
            {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={selectCls} value={selectedCloseReason} onChange={(e) => setSelectedCloseReason(e.target.value)}>
            <option value="all">All reasons</option>
            {Object.entries(CLOSE_REASON_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </div>
        <a href={csvHref}>
          <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </a>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-border bg-muted/50">
            <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-[11px] [&>th]:font-semibold [&>th]:text-muted-foreground [&>th]:uppercase [&>th]:tracking-wide [&>th]:whitespace-nowrap">
              <th>Date Closed</th>
              {showPortfolio && <th>Portfolio</th>}
              <th>Ticker</th>
              <th>Type</th>
              <th>Strike / Entry</th>
              <th>Expiry</th>
              <th>Qty</th>
              <th>P/L</th>
              <th>Days</th>
              <th>Reason</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={showPortfolio ? 11 : 10} className="text-center text-muted-foreground py-10 px-3">
                  No closed trades in this range.
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const pl = calcTotalPL(r);
                const pct = calcPctReturn(r);
                const isStock = r.type === "STOCK_LOT";
                return (
                  <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors [&>td]:px-3 [&>td]:py-3">
                    <td className="whitespace-nowrap text-muted-foreground text-xs">{fmtDateCompact(r.closedAt ?? undefined)}</td>
                    {showPortfolio && (
                      <td className="whitespace-nowrap">
                        <span className="text-xs font-medium text-foreground">{r.portfolioName}</span>
                      </td>
                    )}
                    <td className="whitespace-nowrap font-semibold text-foreground">{r.ticker}</td>
                    <td><TypeBadge type={r.type ?? ""} /></td>
                    <td className="whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                      {isStock
                        ? (r.entryPrice != null ? `$${Number(r.entryPrice).toFixed(2)}` : "—")
                        : (r.strikePrice ? `$${Number(r.strikePrice).toFixed(0)}` : "—")}
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">
                      {isStock ? "—" : fmtDateCompact(typeof r.expirationDate === "string" ? r.expirationDate : undefined)}
                    </td>
                    <td className="whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                      {isStock
                        ? `${r.sharesClosed ?? 0} sh`
                        : `${r.contractsClosed ?? r.contractsInitial ?? 0}x`}
                    </td>
                    <td className="whitespace-nowrap"><PLCell value={pl} pct={pct} /></td>
                    <td className="whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                      {r.holdingDays > 0 ? `${r.holdingDays}d` : "—"}
                    </td>
                    <td><CloseReasonBadge reason={r.closeReason} /></td>
                    <td className="max-w-[180px]">
                      {r.notes ? (
                        <span className="block truncate text-xs text-muted-foreground" title={r.notes}>{r.notes}</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Date filter bar ─────────────────────────────────────────────────────
function DateFilterBar({
  start,
  end,
  onApply,
  mounted,
  selectedPortfolioId,
  setSelectedPortfolioId,
  portfolios,
  portfoliosLoading,
  portfoliosError,
  embedded,
}: {
  start: Date;
  end: Date;
  onApply: (range: { from: Date; to: Date }) => void;
  mounted: boolean;
  selectedPortfolioId: string;
  setSelectedPortfolioId: (id: string) => void;
  portfolios?: PortfolioBasic[];
  portfoliosLoading: boolean;
  portfoliosError?: unknown;
  embedded?: boolean;
}) {
  const [fromLocal, setFromLocal] = useState<Date>(start);
  const [toLocal, setToLocal] = useState<Date>(end);

  useEffect(() => { setFromLocal(start); setToLocal(end); }, [start, end]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* From */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-normal">
            <CalendarIcon className="h-3.5 w-3.5" />
            {mounted ? format(fromLocal, "MMM d, yyyy") : "—"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={fromLocal} onSelect={(d) => d && setFromLocal(startOfDay(d))} disabled={{ after: new Date() }} initialFocus />
        </PopoverContent>
      </Popover>

      <span className="text-muted-foreground text-xs">→</span>

      {/* To */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-normal">
            <CalendarIcon className="h-3.5 w-3.5" />
            {mounted ? format(toLocal, "MMM d, yyyy") : "—"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={toLocal} onSelect={(d) => d && setToLocal(endOfDay(d))} disabled={{ after: new Date() }} initialFocus />
        </PopoverContent>
      </Popover>

      <Button
        size="sm"
        className="h-8 text-xs"
        onClick={() => {
          if (fromLocal && toLocal && !isAfter(startOfDay(fromLocal), endOfDay(toLocal))) {
            onApply({ from: startOfDay(fromLocal), to: endOfDay(toLocal) });
          }
        }}
        disabled={!fromLocal || !toLocal || isAfter(startOfDay(fromLocal), endOfDay(toLocal))}
      >
        Apply
      </Button>

      {/* Portfolio filter — hidden when embedded */}
      {!embedded && (
        <select
          className="ml-auto border border-input bg-background text-foreground rounded-md px-2 py-1 text-sm"
          value={selectedPortfolioId}
          onChange={(e) => setSelectedPortfolioId(e.target.value)}
          disabled={portfoliosLoading || !!portfoliosError}
        >
          <option value="all">All portfolios</option>
          {(portfolios ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
    </div>
  );
}

// ── Root export ─────────────────────────────────────────────────────────
export function AccountsReportContent({
  defaultPortfolioId,
  embedded,
}: {
  defaultPortfolioId?: string;
  embedded?: boolean;
} = {}) {
  const [start, setStart] = useState<Date>(() => startOfDay(new Date()));
  const [end, setEnd] = useState<Date>(() => new Date());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(defaultPortfolioId ?? "all");
  const [selectedTicker, setSelectedTicker] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedCloseReason, setSelectedCloseReason] = useState("all");

  const { data: portfolios, error: portfoliosError, isLoading: portfoliosLoading } = useSWR("/api/portfolios", fetchPortfolios, { revalidateOnFocus: false });

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("start", start.toISOString());
    p.set("end", end.toISOString());
    p.set("format", "json");
    if (selectedPortfolioId) p.set("portfolioId", selectedPortfolioId);
    return p.toString();
  }, [selectedPortfolioId, start, end]);

  const { data, error, isLoading } = useSWR(`/api/reports/closed?${qs}`, fetcher, { revalidateOnFocus: false });

  const csvUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set("start", start.toISOString());
    p.set("end", end.toISOString());
    p.set("format", "csv");
    if (selectedPortfolioId) p.set("portfolioId", selectedPortfolioId);
    return `/api/reports/closed?${p.toString()}`;
  }, [selectedPortfolioId, start, end]);

  const availableTickers = useMemo(() => {
    const uniq = new Set<string>();
    for (const r of data?.rows ?? []) if (r.ticker?.trim()) uniq.add(r.ticker.trim().toUpperCase());
    return Array.from(uniq).sort();
  }, [data?.rows]);

  const availableTypes = useMemo(() => {
    const uniq = new Set<string>();
    for (const r of data?.rows ?? []) if (r.type?.trim()) uniq.add(r.type.trim());
    return Array.from(uniq).sort();
  }, [data?.rows]);

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter((r) => {
      const okTicker = selectedTicker === "all" || (r.ticker ?? "").toUpperCase() === selectedTicker;
      const okType = selectedType === "all" || (r.type ?? "") === selectedType;
      const okReason = selectedCloseReason === "all" || (r.closeReason ?? "manual") === selectedCloseReason;
      return okTicker && okType && okReason;
    });
  }, [data?.rows, selectedTicker, selectedType, selectedCloseReason]);

  // Reset stale filters when data changes
  useEffect(() => {
    if (!data) return;
    if (selectedTicker !== "all" && !availableTickers.includes(selectedTicker)) setSelectedTicker("all");
    if (selectedType !== "all" && !availableTypes.includes(selectedType)) setSelectedType("all");
  }, [availableTickers, availableTypes, data, selectedTicker, selectedType]);

  const showPortfolio = selectedPortfolioId === "all";

  return (
    <div className={cn(embedded ? "space-y-5" : "p-4 sm:p-6 space-y-5")}>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Closed trades · {mounted ? `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}` : "—"}</p>
        </div>
      )}

      <DateFilterBar
        start={start}
        end={end}
        onApply={({ from, to }) => { setStart(from); setEnd(to); }}
        mounted={mounted}
        selectedPortfolioId={selectedPortfolioId}
        setSelectedPortfolioId={setSelectedPortfolioId}
        portfolios={portfolios}
        portfoliosLoading={portfoliosLoading}
        portfoliosError={portfoliosError}
        embedded={embedded}
      />

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-red-500">Failed to load report.</p>}

      {data && (
        <div className="space-y-5">
          <Stats rows={filteredRows} />
          <ReportTable
            rows={filteredRows}
            csvHref={csvUrl}
            showPortfolio={showPortfolio}
            selectedTicker={selectedTicker}
            setSelectedTicker={setSelectedTicker}
            tickers={availableTickers}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            types={availableTypes}
            selectedCloseReason={selectedCloseReason}
            setSelectedCloseReason={setSelectedCloseReason}
          />
        </div>
      )}
    </div>
  );
}

export default AccountsReportContent;
