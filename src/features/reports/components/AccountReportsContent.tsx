"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { format, startOfDay, endOfDay, isAfter } from "date-fns";
import type { Trade } from "@/types";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type PortfolioBasic = { id: string; name: string };
const fetchPortfolios = async (): Promise<PortfolioBasic[]> => {
  const res = await fetch("/api/portfolios", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed ${res.status}`);
  const data = await res.json();
  // Expecting data like { rows: [...] } or array; handle both
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data.rows)
      ? data.rows
      : [];
  return rows.map((p: { id: string; name?: string; title?: string }) => ({
    id: p.id,
    name: p.name ?? p.title ?? p.id,
  }));
};

type ReportRow = Trade & {
  premiumReceived: number;
  premiumPaidToClose: number;
  premiumCapturedComputed: number;
  pctPLOnPremium: number;
  holdingDays: number;
  contractsClosed: number;
  sharesClosed: number;

  // Stock-lot fields (present on STOCK_LOT rows)
  stockExitPrice?: number;
  realizedPnl?: number | null;
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

function calcPremiumCaptured(r: ReportRow): number {
  if (
    typeof r.premiumCaptured === "number" &&
    Number.isFinite(r.premiumCaptured)
  ) {
    return r.premiumCaptured;
  }
  return typeof r.premiumCapturedComputed === "number" &&
    Number.isFinite(r.premiumCapturedComputed)
    ? r.premiumCapturedComputed
    : 0;
}

const getOptionalNumber = (obj: unknown, key: string): number | null => {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

function getShareExitPrice(r: ReportRow): number | null {
  // Try common field names that may exist on Trade/StockLot close flows.
  return (
    getOptionalNumber(r, "stockExitPrice") ??
    getOptionalNumber(r, "stockClosePrice") ??
    getOptionalNumber(r, "closingStockPrice") ??
    getOptionalNumber(r, "exitPrice") ??
    getOptionalNumber(r, "closePrice")
  );
}

function calcSharePL(r: ReportRow): number {
  if (typeof r.realizedPnl === "number" && Number.isFinite(r.realizedPnl)) {
    return r.realizedPnl;
  }

  const shares =
    typeof r.sharesClosed === "number" && Number.isFinite(r.sharesClosed)
      ? r.sharesClosed
      : 0;

  if (shares <= 0) return 0;

  const entry =
    typeof r.entryPrice === "number" && Number.isFinite(r.entryPrice)
      ? r.entryPrice
      : null;

  const exit = getShareExitPrice(r);

  if (entry == null || exit == null) return 0;

  return (exit - entry) * shares;
}

function calcTotalPL(r: ReportRow): number {
  return calcPremiumCaptured(r) + calcSharePL(r);
}

export function AccountsReportContent() {
  const [start, setStart] = useState<Date>(() => startOfDay(new Date()));
  const [end, setEnd] = useState<Date>(() => new Date());

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [selectedPortfolioId, setSelectedPortfolioId] =
    useState<string>("all");
  const [selectedTicker, setSelectedTicker] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCloseReason, setSelectedCloseReason] = useState<string>("all");

  const {
    data: portfolios,
    error: portfoliosError,
    isLoading: portfoliosLoading,
  } = useSWR("/api/portfolios", fetchPortfolios, { revalidateOnFocus: false });

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("start", start.toISOString());
    p.set("end", end.toISOString());
    p.set("format", "json");
    const pid = selectedPortfolioId;
    if (pid) p.set("portfolioId", pid);
    return p.toString();
  }, [selectedPortfolioId, start, end]);

  const { data, error, isLoading } = useSWR(`/api/reports/closed?${qs}`, fetcher, {
    revalidateOnFocus: false,
  });

  const availableTickers = useMemo(() => {
    const rows = data?.rows ?? [];
    const uniq = new Set<string>();
    for (const r of rows) {
      if (typeof r.ticker === "string" && r.ticker.trim().length > 0) {
        uniq.add(r.ticker.trim().toUpperCase());
      }
    }
    return Array.from(uniq).sort((a, b) => a.localeCompare(b));
  }, [data?.rows]);

  const availableTypes = useMemo(() => {
    const rows = data?.rows ?? [];
    const uniq = new Set<string>();
    for (const r of rows) {
      if (typeof r.type === "string" && r.type.trim().length > 0) {
        uniq.add(r.type.trim());
      }
    }
    return Array.from(uniq).sort((a, b) => a.localeCompare(b));
  }, [data?.rows]);

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    const t = selectedTicker !== "all" ? selectedTicker.trim().toUpperCase() : null;
    const ty = selectedType !== "all" ? selectedType.trim() : null;
    const cr = selectedCloseReason !== "all" ? selectedCloseReason.trim() : null;
    if (!t && !ty && !cr) return rows;
    return rows.filter((r) => {
      const okTicker = t ? (r.ticker ?? "").toUpperCase() === t : true;
      const okType = ty ? (r.type ?? "") === ty : true;
      const okReason = cr ? ((r as ReportRow & { closeReason?: string }).closeReason ?? "manual") === cr : true;
      return okTicker && okType && okReason;
    });
  }, [data?.rows, selectedTicker, selectedType, selectedCloseReason]);

  useEffect(() => {
    if (!data) return;
    if (selectedTicker !== "all") {
      const norm = selectedTicker.trim().toUpperCase();
      if (!availableTickers.includes(norm)) setSelectedTicker("all");
    }
    if (selectedType !== "all") {
      const norm = selectedType.trim();
      if (!availableTypes.includes(norm)) setSelectedType("all");
    }
  }, [availableTickers, availableTypes, data, selectedTicker, selectedType]);

  const csvUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set("start", start.toISOString());
    p.set("end", end.toISOString());
    p.set("format", "csv");
    const pid = selectedPortfolioId;
    if (pid) p.set("portfolioId", pid);
    return `/api/reports/closed?${p.toString()}`;
  }, [selectedPortfolioId, start, end]);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <Header
        start={start}
        end={end}
        onApply={({ from, to }) => {
          setStart(from);
          setEnd(to);
        }}
        selectedPortfolioId={selectedPortfolioId}
        setSelectedPortfolioId={setSelectedPortfolioId}
        portfolios={portfolios}
        portfoliosError={portfoliosError}
        portfoliosLoading={portfoliosLoading}
        mounted={mounted}
        selectedTicker={selectedTicker}
        setSelectedTicker={setSelectedTicker}
        tickers={availableTickers}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        types={availableTypes}
        selectedCloseReason={selectedCloseReason}
        setSelectedCloseReason={setSelectedCloseReason}
      />

      {isLoading && <div>Loading…</div>}
      {error && (
        <div className="text-red-600">Failed to load: {String(error)}</div>
      )}

      {data && (
        <div className="rounded-2xl border border-border bg-card text-card-foreground p-4 md:p-6 shadow-sm">
          <div className="space-y-6">
            <Stats rows={filteredRows} />
            <ReportTable
              rows={filteredRows}
              csvHref={csvUrl}
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
        </div>
      )}
    </div>
  );
}

function Header(props: {
  start: Date;
  end: Date;
  onApply: (range: { from: Date; to: Date }) => void;
  selectedPortfolioId: string;
  setSelectedPortfolioId: (id: string) => void;
  portfolios?: PortfolioBasic[];
  portfoliosError?: unknown;
  portfoliosLoading: boolean;
  mounted: boolean;
  selectedTicker: string;
  setSelectedTicker: (ticker: string) => void;
  tickers: string[];
  selectedType: string;
  setSelectedType: (type: string) => void;
  types: string[];
  selectedCloseReason: string;
  setSelectedCloseReason: (r: string) => void;
}) {
  const {
    start,
    end,
    onApply,
    selectedPortfolioId,
    setSelectedPortfolioId,
    portfolios,
    portfoliosError,
    portfoliosLoading,
    mounted,
    selectedTicker,
    selectedType,
  } = props;

  const [fromLocal, setFromLocal] = useState<Date>(start);
  const [toLocal, setToLocal] = useState<Date>(end);
  const [fromMonth, setFromMonth] = useState<Date>(fromLocal);
  const [toMonth, setToMonth] = useState<Date>(toLocal);

  useEffect(() => {
    setFromLocal(start);
    setToLocal(end);
    setFromMonth(start);
    setToMonth(end);
  }, [start, end]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          {selectedPortfolioId === "all" ? "All portfolios" : "Selected portfolio"}
          {selectedType !== "all" ? ` · ${selectedType}` : ""}
          {selectedTicker !== "all" ? ` · ${selectedTicker}` : ""} · Closed trades
          from{" "}
          {mounted ? format(start, "MMM d, yyyy") : "—"} to{" "}
          {mounted ? format(end, "MMM d, yyyy") : "—"}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card text-card-foreground p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-nowrap sm:items-center sm:gap-4">
          {/* From / To */}
          <div className="col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {/* From */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label
                className="text-sm text-muted-foreground shrink-0"
                htmlFor="fromDate"
              >
                From
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="fromDate"
                    variant="outline"
                    className="w-full sm:w-[12rem] justify-start font-normal text-foreground"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {mounted && fromLocal
                      ? format(fromLocal, "MMM d, yyyy")
                      : "—"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromLocal}
                    month={fromMonth}
                    onMonthChange={setFromMonth}
                    onSelect={(d) => d && setFromLocal(startOfDay(d))}
                    disabled={{ after: new Date() }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* To */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label
                className="text-sm text-muted-foreground shrink-0"
                htmlFor="toDate"
              >
                To
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="toDate"
                    variant="outline"
                    className="w-full sm:w-[12rem] justify-start font-normal text-foreground"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {mounted && toLocal ? format(toLocal, "MMM d, yyyy") : "—"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toLocal}
                    month={toMonth}
                    onMonthChange={setToMonth}
                    onSelect={(d) => d && setToLocal(endOfDay(d))}
                    disabled={{ after: new Date() }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Apply */}
          <div className="col-span-2 sm:col-span-1">
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                if (fromLocal && toLocal) {
                  const from = startOfDay(fromLocal);
                  const to = endOfDay(toLocal);
                  if (isAfter(from, to)) return;
                  onApply({ from, to });
                }
              }}
              disabled={
                !fromLocal ||
                !toLocal ||
                isAfter(startOfDay(fromLocal), endOfDay(toLocal))
              }
            >
              Apply
            </Button>
          </div>
          {/* Portfolio */}
          <div className="col-span-2 sm:col-span-1 flex justify-end gap-2 sm:ml-auto">
            <select
              id="portfolio"
              className="border border-input bg-background text-foreground rounded-md px-2 py-1 w-full sm:w-[16rem]"
              value={selectedPortfolioId}
              onChange={(e) => setSelectedPortfolioId(e.target.value)}
              disabled={portfoliosLoading || !!portfoliosError}
            >
              <option value="all">All portfolios</option>
              {(portfolios ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function calcPercentPLPosition(r: ReportRow): number {
  if (typeof r.percentPL === "number" && Number.isFinite(r.percentPL)) {
    const v = r.percentPL;
    return Math.abs(v) > 1 ? v / 100 : v;
  }

  const shares =
    typeof r.sharesClosed === "number" && Number.isFinite(r.sharesClosed)
      ? r.sharesClosed
      : 0;

  const entry =
    typeof r.entryPrice === "number" && Number.isFinite(r.entryPrice)
      ? r.entryPrice
      : null;

  if (shares <= 0 || entry == null) return 0;

  const basis = Math.abs(entry * shares);
  if (basis <= 0) return 0;

  return calcSharePL(r) / basis;
}

function Stats({ rows }: { rows: ReportRow[] }) {
  const totalOverallPL = rows.reduce((s, r) => s + calcTotalPL(r), 0);
  const wins = rows.filter((r) => calcTotalPL(r) > 0);
  const losses = rows.filter((r) => calcTotalPL(r) < 0);
  const winRate = rows.length > 0 ? wins.length / rows.length : null;

  const avgPct = rows.length
    ? rows.reduce((s, r) => s + calcPercentPLPosition(r), 0) / rows.length
    : 0;

  const plValues = rows.map((r) => calcTotalPL(r));
  const bestTrade = plValues.length > 0 ? Math.max(...plValues) : null;
  const worstTrade = plValues.length > 0 ? Math.min(...plValues) : null;

  const holdDays = rows
    .map((r) => {
      if (typeof r.holdingDays === "number" && Number.isFinite(r.holdingDays)) return r.holdingDays;
      if (r.closedAt && r.createdAt) {
        const d = (new Date(r.closedAt).getTime() - new Date(r.createdAt).getTime()) / 86400000;
        return Number.isFinite(d) && d >= 0 ? d : null;
      }
      return null;
    })
    .filter((d): d is number => d !== null);
  const avgHoldDays = holdDays.length > 0 ? holdDays.reduce((s, d) => s + d, 0) / holdDays.length : null;

  const reasonCounts = rows.reduce<Record<string, { count: number; pl: number }>>((acc, r) => {
    const reason = (r as ReportRow & { closeReason?: string }).closeReason ?? "manual";
    if (!acc[reason]) acc[reason] = { count: 0, pl: 0 };
    acc[reason].count += 1;
    acc[reason].pl += calcTotalPL(r);
    return acc;
  }, {});

  const reasonLabels: Record<string, string> = {
    expiredWorthless: "Expired Worthless",
    assigned: "Assigned",
    manual: "Manual Close",
  };

  const fmtUSDStat = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="space-y-3">
      {/* 3 primary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          label="Total P/L"
          value={fmtUSDStat(totalOverallPL)}
          tone={totalOverallPL >= 0 ? "success" : "danger"}
        />
        <Stat
          label="Win Rate"
          value={winRate !== null ? `${(winRate * 100).toFixed(0)}%` : "—"}
          sub={winRate !== null ? `${wins.length}W · ${losses.length}L · ${rows.length} trades` : undefined}
          tone={winRate !== null ? (winRate >= 0.5 ? "success" : "warning") : "default"}
        />
        <Stat
          label="Avg % P/L"
          value={`${(avgPct * 100).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
          tone={avgPct >= 0 ? "success" : "danger"}
        />
      </div>

      {/* Secondary metrics — compact inline row */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-1 text-xs text-muted-foreground">
        {avgHoldDays !== null && (
          <span>Avg hold <span className="font-medium text-foreground">{avgHoldDays.toFixed(1)}d</span></span>
        )}
        {bestTrade !== null && (
          <span>Best <span className="font-medium text-green-600 dark:text-green-400">{fmtUSDStat(bestTrade)}</span></span>
        )}
        {worstTrade !== null && (
          <span>Worst <span className={`font-medium ${worstTrade < 0 ? "text-red-500 dark:text-red-400" : "text-foreground"}`}>{fmtUSDStat(worstTrade)}</span></span>
        )}
        {Object.entries(reasonCounts).map(([reason, { count, pl }]) => (
          <span key={reason}>
            {reasonLabels[reason] ?? reason}{" "}
            <span className="font-medium text-foreground">{count}</span>
            <span className="mx-0.5 opacity-40">·</span>
            <span className={pl >= 0 ? "font-medium text-green-600 dark:text-green-400" : "font-medium text-red-500 dark:text-red-400"}>
              {pl >= 0 ? "+" : ""}{fmtUSDStat(pl)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

type StatTone = "default" | "success" | "danger" | "warning";

function Stat({ label, value, tone = "default", sub }: { label: string; value: string; tone?: StatTone; sub?: string }) {
  const valueClass =
    tone === "success"
      ? "text-green-600 dark:text-green-400"
      : tone === "danger"
        ? "text-red-500 dark:text-red-400"
        : tone === "warning"
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card text-card-foreground p-4 shadow-sm">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${valueClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function ReportTable(props: {
  rows: ReportRow[];
  csvHref: string;
  selectedTicker: string;
  setSelectedTicker: (ticker: string) => void;
  tickers: string[];
  selectedType: string;
  setSelectedType: (type: string) => void;
  types: string[];
  selectedCloseReason: string;
  setSelectedCloseReason: (r: string) => void;
}) {
  const {
    rows,
    csvHref,
    selectedTicker,
    setSelectedTicker,
    tickers,
    selectedType,
    setSelectedType,
    types,
    selectedCloseReason,
    setSelectedCloseReason,
  } = props;

  const closeReasonLabels: Record<string, string> = {
    manual: "Manual",
    expiredWorthless: "Expired Worthless",
    assigned: "Assigned",
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aTime = new Date(a.closedAt ?? a.createdAt).getTime();
      const bTime = new Date(b.closedAt ?? b.createdAt).getTime();
      return aTime - bTime;
    });
  }, [rows]);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "dateClosed", desc: true },
  ]);

  const columns: ColumnDef<ReportRow, unknown>[] = useMemo(
    () => [
      {
        header: "Date Opened",
        accessorFn: (r) => r.createdAt,
        cell: ({ getValue }) => fmtDate(String(getValue())),
      },
      {
        id: "dateClosed",
        header: "Date Closed",
        accessorFn: (r) => r.closedAt ?? "",
        cell: ({ getValue }) => {
          const v = getValue();
          return v ? fmtDate(String(v)) : "—";
        },
      },
      {
        id: "ticker",
        header: "Ticker",
        accessorFn: (r) => r.ticker ?? "",
        enableSorting: true,
      },
      {
        header: "Strike",
        accessorKey: "strikePrice",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtUSD(Number(getValue()))}</span>
        ),
      },
      {
        header: "Stock Entry Price",
        accessorKey: "entryPrice",
        cell: ({ getValue }) => {
          const v = getValue();
          return v == null ? (
            "—"
          ) : (
            <span className="tabular-nums">{fmtUSD(Number(v))}</span>
          );
        },
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (r) => r.type,
        enableSorting: true,
      },
      {
        header: "Exp",
        accessorFn: (r) => r.expirationDate,
        cell: ({ getValue }) => fmtDate(String(getValue())),
      },
      {
        header: "Contracts",
        accessorFn: (r) => r.contractsInitial ?? r.contracts,
      },
      {
        header: "Shares Closed",
        accessorFn: (r) => r.sharesClosed ?? 0,
        cell: ({ getValue }) => (
          <span className="tabular-nums">
            {Number(getValue()).toLocaleString()}
          </span>
        ),
      },
      {
        id: "pl",
        header: "P/L",
        accessorFn: (r) => calcTotalPL(r),
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtUSD(Number(getValue()))}</span>
        ),
      },
      {
        header: "% P/L",
        accessorFn: (r) => calcPercentPLPosition(r) * 100,
        cell: ({ getValue }) => {
          const n = Number(getValue());
          const text = `${n.toLocaleString(undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}%`;
          const cls =
            n > 0
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : n < 0
                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                : "bg-muted text-muted-foreground";
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
            >
              {text}
            </span>
          );
        },
      },
      {
        id: "closeReason",
        header: "Close Reason",
        accessorFn: (r) => (r as ReportRow & { closeReason?: string }).closeReason ?? "manual",
        cell: ({ getValue }) => closeReasonLabels[String(getValue())] ?? String(getValue()),
      },
      {
        header: "Notes",
        accessorKey: "notes",
        cell: ({ getValue }) => {
          const v = getValue() as string | null | undefined;
          if (!v || v.trim().length === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <span
              className="block max-w-[200px] truncate text-muted-foreground"
              title={v}
            >
              {v}
            </span>
          );
        },
      },
    ],
    [closeReasonLabels],
  );

  const table = useReactTable({
    data: sortedRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground" htmlFor="type-inline">
              Type
            </label>
            <select
              id="type-inline"
              className="border border-input bg-background text-foreground rounded-md px-2 py-1 w-full sm:w-auto sm:min-w-[10rem]"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              disabled={types.length === 0}
            >
              <option value="all">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground" htmlFor="ticker-inline">
              Ticker
            </label>
            <select
              id="ticker-inline"
              className="border border-input bg-background text-foreground rounded-md px-2 py-1 w-full sm:w-auto sm:min-w-[10rem]"
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              disabled={tickers.length === 0}
            >
              <option value="all">All tickers</option>
              {tickers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground" htmlFor="reason-inline">
              Close Reason
            </label>
            <select
              id="reason-inline"
              className="border border-input bg-background text-foreground rounded-md px-2 py-1 w-full sm:w-auto sm:min-w-[10rem]"
              value={selectedCloseReason}
              onChange={(e) => setSelectedCloseReason(e.target.value)}
            >
              <option value="all">All reasons</option>
              {Object.entries(closeReasonLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <a href={csvHref} className="block">
            <Button className="w-full sm:w-auto">Export CSV</Button>
          </a>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-muted/60 [&>th]:px-4 [&>th]:py-2.5 text-left">
                {hg.headers.map((header) => (
                  <th key={header.id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span>
                          {header.column.getIsSorted() === "asc"
                            ? "▲"
                            : header.column.getIsSorted() === "desc"
                              ? "▼"
                              : ""}
                        </span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-border hover:bg-muted/40 transition-colors [&>td]:px-4 [&>td]:py-3"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cell.column.id === "notes" ? "max-w-[200px]" : "whitespace-nowrap"}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-8"
                >
                  No closed trades in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, "MMM d, yyyy");
}

function fmtUSD(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

export default AccountsReportContent;
