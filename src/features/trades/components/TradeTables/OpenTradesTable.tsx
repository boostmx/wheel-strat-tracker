"use client";

import { useMemo, useState, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { makeOpenColumns } from "./columns-open";
import { Trade } from "@/types";
import { CloseTradeModal } from "@/features/trades/components/CloseTradeModal";
import { mutate } from "swr";
import useSWR from "swr";
import type { QuoteResult } from "@/app/api/quotes/route";

type QuoteMap = Record<string, QuoteResult>;
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, XCircle } from "lucide-react";
import { TypeBadge } from "@/features/trades/components/TypeBadge";
import { useRouter } from "next/navigation";
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";

// ---------- Helpers ----------
const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const isCashSecuredPut = (type?: string) => {
  if (!type) return false;
  const t = type.toLowerCase().replaceAll(/\s+/g, "");
  return t === "cashsecuredput" || t === "csp";
};

const isCoveredCall = (type?: string) =>
  !!type && type.toLowerCase().includes("covered") && type.toLowerCase().includes("call");

const calcCapitalInUse = (t: Trade) => {
  if (isCashSecuredPut(t.type)) {
    return t.strikePrice * 100 * (t.contractsOpen ?? t.contracts ?? 0);
  }
  if (isCoveredCall(t.type) && t.entryPrice != null) {
    return t.entryPrice * 100 * (t.contractsOpen ?? t.contracts ?? 0);
  }
  return 0;
};

const calcAllocationPct = (t: Trade, totalCapital: number) => {
  if (totalCapital <= 0) return null;
  const capital = calcCapitalInUse(t);
  if (capital <= 0) return null;
  return (capital / totalCapital) * 100;
};

const calcOpenPremium = (t: Trade) => {
  // Only relevant for short options: CSP and Covered Calls
  if (isCashSecuredPut(t.type) || isCoveredCall(t.type)) {
    return (t.contractPrice ?? 0) * 100 * (t.contractsOpen ?? t.contracts ?? 0);
  }
  return undefined; // Not applicable for long Puts/Calls
};

const calcBreakeven = (t: Trade) => {
  const premiumPerShare = t.contractPrice ?? 0;
  if (isCashSecuredPut(t.type)) {
    return t.strikePrice - premiumPerShare;
  }
  if (t.type?.toLowerCase().includes("covered")) {
    return t.entryPrice != null ? t.entryPrice - premiumPerShare : undefined;
  }
  return undefined;
};

const buildTooltipContent = (t: Trade, totalCapital?: number) => {
  const allocPct = totalCapital != null ? calcAllocationPct(t, totalCapital) : null;
  return (
  <div className="text-xs space-y-1">
    {calcCapitalInUse(t) > 0 && (
      <div>
        Capital in use:{" "}
        <span className="font-medium">{formatUSD(calcCapitalInUse(t))}</span>
      </div>
    )}
    {allocPct != null && (
      <div>
        Portfolio allocation:{" "}
        <span className="font-medium">{allocPct.toFixed(1)}%</span>
      </div>
    )}
    <div>
      Open premium (total):{" "}
      {typeof calcOpenPremium(t) === "number" ? (
        <span className="font-medium">{formatUSD(calcOpenPremium(t) as number)}</span>
      ) : (
        <span className="font-medium">-</span>
      )}
    </div>
    {typeof t.entryPrice === "number" && isFinite(t.entryPrice) && (
      <div>
        Entry Price:{" "}
        <span className="font-medium">{formatUSD(t.entryPrice)}</span>
      </div>
    )}
    {typeof calcBreakeven(t) === "number" && (
      <div>
        Breakeven:{" "}
        <span className="font-medium">{formatUSD(calcBreakeven(t)!)}</span>
      </div>
    )}
    {t.createdAt && (
      <div>
        Opened on:{" "}
        <span className="font-medium">
          {formatDateOnlyUTC(new Date(t.createdAt))}
        </span>
      </div>
    )}
  </div>
  );
};

type Timeframe = "week" | "month" | "year" | "all";

const toTimeframe = (v: string): Timeframe =>
  v === "week" || v === "month" || v === "year" || v === "all" ? v : "all";

const getStartDate = (tf: Timeframe) => {
  const now = new Date();
  const d = new Date(now);
  if (tf === "week") d.setDate(d.getDate() - 7);
  if (tf === "month") d.setMonth(d.getMonth() - 1);
  if (tf === "year") d.setFullYear(d.getFullYear() - 1);
  return tf === "all" ? null : d;
};

const getTradeOpenDate = (t: Trade): Date | undefined => {
  // Prefer createdAt for open trades; fallback to updatedAt if needed
  const toDate = (val: unknown): Date | undefined => {
    if (val == null) return undefined;
    const d = new Date(val as string | number | Date);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  return toDate(t.createdAt);
};

const makeInfoColumn = (totalCapital?: number): ColumnDef<Trade> => ({
  id: "info",
  header: "",
  enableSorting: false,
  size: 28,
  minSize: 28,
  maxSize: 32,
  cell: ({ row }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1"
          aria-label="More info"
        >
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={10}
        collisionPadding={8}
        className="max-w-xs"
      >
        {buildTooltipContent(row.original, totalCapital)}
      </TooltipContent>
    </Tooltip>
  ),
});

const makeAllocationColumn = (totalCapital: number): ColumnDef<Trade> => ({
  id: "allocation",
  header: "Allocation",
  enableSorting: true,
  accessorFn: (row) => calcAllocationPct(row, totalCapital) ?? -1,
  cell: ({ row }) => {
    const pct = calcAllocationPct(row.original, totalCapital);
    return pct != null ? (
      <span>{pct.toFixed(1)}%</span>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  },
  meta: { align: "right" },
});

const makePriceColumn = (quotes: QuoteMap, isLoading: boolean): ColumnDef<Trade> => ({
  id: "livePrice",
  header: "Price",
  enableSorting: true,
  accessorFn: (row) => quotes[row.ticker]?.price ?? -1,
  cell: ({ row }) => {
    const q = quotes[row.original.ticker];
    if (isLoading && !q) return <span className="text-muted-foreground text-xs">—</span>;
    if (!q?.price) return <span className="text-muted-foreground text-xs">n/a</span>;
    return (
      <div>
        <div className="tabular-nums font-medium">{formatUSD(q.price)}</div>
        {q.changePct != null && (
          <div className={`text-xs tabular-nums ${q.changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
            {q.changePct >= 0 ? "▲" : "▼"}{Math.abs(q.changePct).toFixed(2)}%
          </div>
        )}
      </div>
    );
  },
  meta: { align: "right" },
});

const makeOtmColumn = (quotes: QuoteMap): ColumnDef<Trade> => ({
  id: "otmPct",
  header: "OTM %",
  enableSorting: true,
  accessorFn: (row) => {
    const price = quotes[row.ticker]?.price ?? null;
    if (!price) return -999;
    if (isCashSecuredPut(row.type)) return ((price - row.strikePrice) / price) * 100;
    if (isCoveredCall(row.type)) return ((row.strikePrice - price) / price) * 100;
    return -999;
  },
  cell: ({ row }) => {
    const t = row.original;
    const price = quotes[t.ticker]?.price ?? null;
    if (!price) return <span className="text-muted-foreground">—</span>;
    let otmPct: number | null = null;
    if (isCashSecuredPut(t.type)) otmPct = ((price - t.strikePrice) / price) * 100;
    else if (isCoveredCall(t.type)) otmPct = ((t.strikePrice - price) / price) * 100;
    if (otmPct == null) return <span className="text-muted-foreground">—</span>;
    const isITM = otmPct < 0;
    return (
      <span className={`text-xs font-semibold tabular-nums ${isITM ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
        {isITM ? "ITM " : ""}{Math.abs(otmPct).toFixed(1)}%{!isITM ? " OTM" : ""}
      </span>
    );
  },
  meta: { align: "right" },
});

// ---------- Component ----------
export function OpenTradesTable({
  trades,
  portfolioId,
  totalCapital,
}: {
  trades: Trade[];
  portfolioId: string;
  totalCapital?: number;
}) {
  const router = useRouter();
  // Default sort: soonest expiration first
  const [sorting, setSorting] = useState<SortingState>([
    { id: "expirationDate", desc: false },
  ]);
  const [selectedTrade, setSelectedTrade] = useState<{
    id: string;
    strikePrice: number;
    contracts: number;
  } | null>(null);

  // Live quotes
  const quoteTickers = useMemo(() => {
    const tickers = [...new Set(trades.map((t) => t.ticker).filter(Boolean))];
    return tickers.length > 0 ? tickers.join(",") : null;
  }, [trades]);
  const { data: quoteData, isLoading: quotesLoading } = useSWR<QuoteMap>(
    quoteTickers ? `/api/quotes?tickers=${quoteTickers}` : null,
    { refreshInterval: 60_000, dedupingInterval: 30_000 },
  );
  const quotes: QuoteMap = quoteData ?? {};

  // Mobile filters sheet
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Pagination & Filters
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageIndex, setPageIndex] = useState<number>(0);

  // No longer need responsive column visibility logic (Option 1 removed)

  const filteredTrades = useMemo(() => {
    const start = getStartDate(timeframe);
    if (!start) return trades;
    return trades.filter((t) => {
      const opened = getTradeOpenDate(t);
      if (!opened) return true;
      return opened >= start;
    });
  }, [trades, timeframe]);

  useEffect(() => {
    setPageIndex(0);
  }, [timeframe, pageSize]);

  const columns = useMemo(() => {
    const base = makeOpenColumns() as ColumnDef<Trade, unknown>[];
    const cols: ColumnDef<Trade, unknown>[] = [makeInfoColumn(totalCapital), ...base];
    if (totalCapital != null && totalCapital > 0) {
      cols.push(makeAllocationColumn(totalCapital));
    }
    cols.push(makePriceColumn(quotes, quotesLoading));
    cols.push(makeOtmColumn(quotes));
    return cols;
  }, [totalCapital, quotes, quotesLoading]);

  const table = useReactTable({
    data: filteredTrades,
    columns,
    state: { sorting },
    initialState: {
      sorting: [{ id: "expirationDate", desc: false }],
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Rows after sorting
  const allRows = table.getRowModel().rows;
  const totalRows = allRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const pageRows = allRows.slice(start, end);

  // Metrics for header (client-side, uses visible rows)
  const metrics = useMemo(() => {
    const originals = allRows.map((r) => r.original as Trade);
    const count = originals.length;
    const totalOpenPremium = originals.reduce((sum, t) => {
      const v = calcOpenPremium(t);
      return sum + (typeof v === "number" ? v : 0);
    }, 0);
    return { count, totalOpenPremium };
  }, [allRows]);

  return (
    <div className="w-full overflow-x-auto">
      {/* Mobile toolbar: Filters + Pagination */}
      <div className="mb-3 md:hidden px-4 pt-4 flex items-center justify-between">
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="p-4">
            <SheetHeader>
              <SheetTitle>Open Trades Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="ot-timeframe-mobile" className="text-sm">
                  Timeframe
                </Label>
                <Select
                  value={timeframe}
                  onValueChange={(v) => setTimeframe(toTimeframe(v))}
                >
                  <SelectTrigger id="ot-timeframe-mobile" className="w-40">
                    <SelectValue placeholder="Select timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                    <SelectItem value="year">Last 12 months</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="ot-pagesize-mobile" className="text-sm">
                  Rows
                </Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(Number(v))}
                >
                  <SelectTrigger id="ot-pagesize-mobile" className="w-28">
                    <SelectValue placeholder="Rows" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SheetFooter className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltersOpen(false)}
              >
                Close
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Compact mobile pagination */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex === 0}
          >
            ‹ Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            {Math.min(pageIndex + 1, pageCount)}/{pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
            disabled={pageIndex >= pageCount - 1}
          >
            Next ›
          </Button>
        </div>
      </div>
      {/* Controls & Metrics */}
      <div className="mb-3 px-4 pt-4 hidden md:flex md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="ot-timeframe" className="text-sm">
              Timeframe
            </Label>
            <Select
              value={timeframe}
              onValueChange={(v) => setTimeframe(toTimeframe(v))}
            >
              <SelectTrigger id="ot-timeframe" className="w-44">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
                <SelectItem value="year">Last 12 months</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="ot-pagesize" className="text-sm">
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
            >
              <SelectTrigger id="ot-pagesize" className="w-28">
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metrics summary */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground w-full sm:w-auto">
          <div>
            <div className="uppercase text-[11px] tracking-wide">
              Open trades
            </div>
            <div className="text-base font-semibold text-foreground">
              {metrics.count}
            </div>
          </div>
          <div>
            <div className="uppercase text-[11px] tracking-wide">
              Open premium (total)
            </div>
            <div className="text-base font-semibold text-foreground">
              {formatUSD(metrics.totalOpenPremium)}
            </div>
          </div>
        </div>
      </div>
      {/* Mobile cards (shown on <md) */}
      <div className="md:hidden space-y-2">
        {pageRows.length === 0 ? (
          <div className="rounded border p-3 text-center text-sm text-muted-foreground">
            No trades currently open.
          </div>
        ) : (
          pageRows.map((row) => {
            const t = row.original as Trade;
            return (
              <button
                key={t.id}
                onClick={() =>
                  router.push(`/portfolios/${portfolioId}/trades/${t.id}`)
                }
                className="w-full text-left rounded-xl border p-3 bg-card hover:bg-accent transition"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{t.ticker}</div>
                  <TypeBadge type={t.type} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Strike</span> $
                    {t.strikePrice.toFixed(2)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Exp</span>{" "}
                    {formatDateOnlyUTC(new Date(t.expirationDate))}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Premium</span>{" "}
                    {isCashSecuredPut(t.type) || isCoveredCall(t.type)
                      ? formatUSD(
                          (t.contractPrice ?? 0) *
                            100 *
                            (t.contractsOpen ?? t.contracts ?? 0),
                        )
                      : "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contracts</span>{" "}
                    {t.contractsOpen ?? t.contracts ?? 0}
                  </div>
                  <div>
                    <span className="text-muted-foreground">DTE</span>{" "}
                    {(() => {
                      const exp = new Date(t.expirationDate);
                      const now = new Date();
                      const dte = Math.max(0, Math.ceil((Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate()) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86_400_000));
                      return <span className={dte <= 7 ? "text-rose-600 font-semibold" : dte <= 21 ? "text-amber-600" : ""}>{dte}d</span>;
                    })()}
                  </div>
                  {totalCapital != null && totalCapital > 0 && (() => {
                    const pct = calcAllocationPct(t, totalCapital);
                    return pct != null ? (
                      <div>
                        <div className="text-xs text-muted-foreground">Allocation</div>
                        <div>{pct.toFixed(1)}%</div>
                      </div>
                    ) : null;
                  })()}
                  {(() => {
                    const q = quotes[t.ticker];
                    if (!q?.price) return null;
                    let otmPct: number | null = null;
                    if (isCashSecuredPut(t.type)) otmPct = ((q.price - t.strikePrice) / q.price) * 100;
                    else if (isCoveredCall(t.type)) otmPct = ((t.strikePrice - q.price) / q.price) * 100;
                    const isITM = otmPct != null && otmPct < 0;
                    return (
                      <>
                        <div>
                          <div className="text-xs text-muted-foreground">Price</div>
                          <div className="tabular-nums font-medium">{formatUSD(q.price)}</div>
                          {q.changePct != null && (
                            <div className={`text-xs tabular-nums ${q.changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                              {q.changePct >= 0 ? "▲" : "▼"}{Math.abs(q.changePct).toFixed(2)}%
                            </div>
                          )}
                        </div>
                        {otmPct != null && (
                          <div>
                            <div className="text-xs text-muted-foreground">OTM %</div>
                            <div className={`text-xs font-semibold tabular-nums ${isITM ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {isITM ? "ITM " : ""}{Math.abs(otmPct).toFixed(1)}%{!isITM ? " OTM" : ""}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </button>
            );
          })
        )}
      </div>
      {/* Desktop table (shown on md+) */}
      <div className="hidden md:block">
        <TooltipProvider delayDuration={150}>
          <table className="min-w-full text-sm text-left text-foreground">
            <thead className="border-b border-border/60">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={
                        header.column.getCanSort()
                          ? "px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide cursor-pointer select-none"
                          : "px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide select-none"
                      }
                      onClick={
                        header.column.getCanSort()
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-[10px] text-muted-foreground">
                            {header.column.getIsSorted() === "asc" && "▲"}
                            {header.column.getIsSorted() === "desc" && "▼"}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={table.getAllColumns().length}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No trades currently open.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={row.id}
                    className="group border-b border-border/40 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/portfolios/${portfolioId}/trades/${row.original.id}`,
                      )
                    }
                  >
                    {row.getVisibleCells().map((cell, idx) => {
                      const isLast = idx === row.getVisibleCells().length - 1;
                      return (
                        <td
                          key={cell.id}
                          className={
                            isLast ? "relative px-4 py-2 pr-10" : "px-4 py-2"
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                          {isLast && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const t = row.original;
                                      setSelectedTrade({
                                        id: t.id,
                                        strikePrice: t.strikePrice,
                                        contracts:
                                          t.contractsOpen ?? t.contracts ?? 0,
                                      });
                                    }}
                                    className="text-gray-400 hover:text-emerald-600 dark:text-gray-500 dark:hover:text-emerald-400"
                                    aria-label="Close position"
                                  >
                                    <XCircle className="h-5 w-5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="left"
                                  align="center"
                                  sideOffset={8}
                                >
                                  Close position
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TooltipProvider>
      </div>
      {/* Pagination footer */}
      <div className="mt-3 px-4 pb-4 hidden md:flex items-center justify-between">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          Page {Math.min(pageIndex + 1, pageCount)} of {pageCount} • {totalRows}{" "}
          result{totalRows === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageIndex(0)}
            disabled={pageIndex === 0}
          >
            « First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex === 0}
          >
            ‹ Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
            disabled={pageIndex >= pageCount - 1}
          >
            Next ›
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageIndex(pageCount - 1)}
            disabled={pageIndex >= pageCount - 1}
          >
            Last »
          </Button>
        </div>
      </div>
      {selectedTrade && (
        <CloseTradeModal
          id={selectedTrade.id}
          portfolioId={portfolioId}
          strikePrice={selectedTrade.strikePrice}
          contracts={selectedTrade.contracts}
          isOpen={!!selectedTrade}
          onClose={() => setSelectedTrade(null)}
          refresh={() => {
            mutate(`/api/trades?portfolioId=${portfolioId}&status=open`);
            mutate(`/api/trades?portfolioId=${portfolioId}&status=closed`);
          }}
        />
      )}
    </div>
  );
}
