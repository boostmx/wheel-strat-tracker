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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, XCircle } from "lucide-react";
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

const isCashSecuredPut = (type?: string) =>
  !!type &&
  type.toLowerCase().includes("put") &&
  !type.toLowerCase().includes("covered");

const calcCapitalInUse = (t: Trade) =>
  isCashSecuredPut(t.type) ? t.strikePrice * 100 * t.contracts : 0;

const calcOpenPremium = (t: Trade) =>
  (t.contractPrice ?? 0) * 100 * t.contracts;

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

const buildTooltipContent = (t: Trade) => (
  <div className="text-xs space-y-1">
    {isCashSecuredPut(t.type) && (
      <div>
        Capital in use:{" "}
        <span className="font-medium">{formatUSD(calcCapitalInUse(t))}</span>
      </div>
    )}
    <div>
      Open premium (total):{" "}
      <span className="font-medium">{formatUSD(calcOpenPremium(t))}</span>
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

const infoColumn: ColumnDef<Trade> = {
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
        {buildTooltipContent(row.original)}
      </TooltipContent>
    </Tooltip>
  ),
};

// ---------- Component ----------
export function OpenTradesTable({
  trades,
  portfolioId,
}: {
  trades: Trade[];
  portfolioId: string;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedTrade, setSelectedTrade] = useState<{
    id: string;
    strikePrice: number;
    contracts: number;
  } | null>(null);

  // Mobile filters sheet
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Pagination & Filters
  const [timeframe, setTimeframe] = useState<Timeframe>("month");
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
    return [infoColumn, ...base];
  }, []);

  const table = useReactTable({
    data: filteredTrades,
    columns,
    state: { sorting },
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
    const totalOpenPremium = originals.reduce(
      (sum, t) => sum + calcOpenPremium(t),
      0,
    );
    return { count, totalOpenPremium };
  }, [allRows]);

  return (
    <div className="w-full overflow-x-auto">
      {/* Mobile toolbar: Filters + Pagination */}
      <div className="mb-3 md:hidden flex items-center justify-between">
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
      <div className="mb-3 hidden md:flex md:flex-row md:items-center md:justify-between">
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
                  router.push(`/portfolio/${portfolioId}/trade/${t.id}`)
                }
                className="w-full text-left rounded-xl border p-3 bg-card hover:bg-accent transition"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{t.ticker}</div>
                  <div className="text-xs text-muted-foreground">{t.type}</div>
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
                  {typeof t.contractPrice === "number" && (
                    <div>
                      <span className="text-muted-foreground">Premium</span>{" "}
                      {formatUSD((t.contractPrice ?? 0) * 100 * t.contracts)}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Contracts</span>{" "}
                    {t.contracts}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
      {/* Desktop table (shown on md+) */}
      <div className="hidden md:block">
        <TooltipProvider delayDuration={150}>
          <table className="min-w-full text-sm text-left text-gray-700 dark:text-gray-100">
            <thead className="bg-gray-100 dark:bg-gray-800">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-2 font-semibold cursor-pointer select-none dark:text-gray-200"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
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
                    className="px-4 py-4 text-center text-gray-500 dark:text-gray-400"
                  >
                    No trades currently open.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={row.id}
                    className="group border-t border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/portfolio/${portfolioId}/trade/${row.original.id}`,
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
                                        contracts: t.contracts,
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
      <div className="mt-3 hidden md:flex items-center justify-between">
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
