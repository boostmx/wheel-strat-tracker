"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  flexRender,
} from "@tanstack/react-table";
import { makeClosedColumns } from "./columns-closed";
import { Trade } from "@/types";
import { useRouter } from "next/navigation";
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

type TradeLike = Trade & {
  closedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
  percentPL?: number | null;
  premiumCaptured?: number | null;
  contractPrice?: number | null;
  contracts?: number | null;
  contractsInitial?: number | null;
};
type Timeframe = "week" | "month" | "year" | "all";

// --- Helper utilities ---
const toTimeframe = (v: string): Timeframe =>
  v === "week" || v === "month" || v === "year" || v === "all" ? v : "all";

const toDate = (val: unknown): Date | undefined => {
  if (val === null || val === undefined) return undefined;
  const d = new Date(val as string | number | Date);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const getTradeClosedDate = (t: Trade | TradeLike): Date | undefined => {
  const tl = t as Partial<TradeLike>;
  return toDate(tl.closedAt) ?? toDate(tl.updatedAt) ?? toDate(tl.createdAt);
};

const computePercentPl = (t: Trade | TradeLike): number | null => {
  const tl = t as Partial<TradeLike>;
  const direct =
    typeof tl.percentPL === "number" && !Number.isNaN(tl.percentPL)
      ? tl.percentPL
      : null;
  if (direct !== null) return direct;

  // Fallback: derive from premiumCaptured vs initial premium received (contractPrice * contractsInitial * 100)
  const premium =
    typeof tl.premiumCaptured === "number" ? tl.premiumCaptured : null;
  const cp = typeof tl.contractPrice === "number" ? tl.contractPrice : null;
  const ci = (tl as TradeLike).contractsInitial;
  const contractsInitial =
    typeof ci === "number"
      ? ci
      : typeof tl.contracts === "number"
        ? tl.contracts
        : null;

  if (
    premium !== null &&
    cp !== null &&
    cp > 0 &&
    contractsInitial !== null &&
    contractsInitial > 0
  ) {
    const denom = cp * contractsInitial * 100;
    if (denom > 0) return (premium / denom) * 100;
  }
  return null;
};

const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export function ClosedTradesTable({
  trades,
  portfolioId,
}: {
  trades: Trade[];
  portfolioId: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const router = useRouter();

  // Mobile filters sheet
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Pagination & Filters
  const [timeframe, setTimeframe] = useState<"week" | "month" | "year" | "all">(
    "month",
  );
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageIndex, setPageIndex] = useState<number>(0);

  // Determine start date for selected timeframe
  function getStartDate(tf: "week" | "month" | "year" | "all") {
    const now = new Date();
    const d = new Date(now);
    if (tf === "week") d.setDate(d.getDate() - 7);
    if (tf === "month") d.setMonth(d.getMonth() - 1);
    if (tf === "year") d.setFullYear(d.getFullYear() - 1);
    return tf === "all" ? null : d;
  }

  const filteredTrades = useMemo(() => {
    const start = getStartDate(timeframe);
    if (!start) return trades;
    return trades.filter((t) => {
      // Prefer closedAt; fall back to updatedAt or createdAt if needed
      const closedAt = getTradeClosedDate(t);
      if (!closedAt) return true; // keep if unknown
      return closedAt >= start;
    });
  }, [trades, timeframe]);

  // Reset to first page when filters or page size change
  useEffect(() => {
    setPageIndex(0);
  }, [timeframe, pageSize]);

  const table = useReactTable({
    data: filteredTrades,
    columns: makeClosedColumns(),
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Table rows after sorting
  const allRows = table.getRowModel().rows;
  const totalRows = allRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const pageRows = allRows.slice(start, end);

  // Metrics (guarded for optional fields)
  const metrics = useMemo(() => {
    const originals = allRows.map((r) => r.original as TradeLike);
    const count = originals.length;

    const percentVals: number[] = originals
      .map((t) => computePercentPl(t))
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    const avgPercentPL = percentVals.length
      ? percentVals.reduce((a, b) => a + b, 0) / percentVals.length
      : null;

    const premiumVals: number[] = originals
      .map((t) =>
        typeof t.premiumCaptured === "number" ? t.premiumCaptured : undefined,
      )
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    const totalPremiumCaptured = premiumVals.length
      ? premiumVals.reduce((a, b) => a + b, 0)
      : null;

    return { count, avgPercentPL, totalPremiumCaptured };
  }, [allRows]);

  return (
    <div className="w-full">
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
              <SheetTitle>Closed Trades Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="ct-timeframe-mobile" className="text-sm">
                  Timeframe
                </Label>
                <Select
                  value={timeframe}
                  onValueChange={(v) => setTimeframe(toTimeframe(v))}
                >
                  <SelectTrigger id="ct-timeframe-mobile" className="w-40">
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
                <Label htmlFor="ct-pagesize-mobile" className="text-sm">
                  Rows
                </Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(Number(v))}
                >
                  <SelectTrigger id="ct-pagesize-mobile" className="w-28">
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
            <Label htmlFor="timeframe" className="text-sm">
              Timeframe
            </Label>
            <Select
              value={timeframe}
              onValueChange={(v) => setTimeframe(toTimeframe(v))}
            >
              <SelectTrigger id="timeframe" className="w-44">
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
            <Label htmlFor="pagesize" className="text-sm">
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
            >
              <SelectTrigger id="pagesize" className="w-28">
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
              Closed trades
            </div>
            <div className="text-base font-semibold text-foreground">
              {metrics.count}
            </div>
          </div>
          <div>
            <div className="uppercase text-[11px] tracking-wide">
              Total Premium
            </div>
            <div className="text-base font-semibold text-foreground">
              {metrics.totalPremiumCaptured !== null
                ? formatUSD(metrics.totalPremiumCaptured)
                : "—"}
            </div>
          </div>
          <div>
            <div className="uppercase text-[11px] tracking-wide">Avg % P/L</div>
            <div className="text-base font-semibold text-foreground">
              {metrics.avgPercentPL !== null
                ? `${Number(metrics.avgPercentPL).toFixed(2)}%`
                : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        {/* Mobile cards (shown on <md) */}
        <div className="md:hidden space-y-2">
          {pageRows.length === 0 ? (
            <div className="rounded border p-3 text-center text-sm text-muted-foreground">
              No trades have been closed yet.
            </div>
          ) : (
            pageRows.map((row) => {
              const t = row.original as TradeLike;
              const closedDate = getTradeClosedDate(t);
              const percent =
                typeof t.percentPL === "number"
                  ? `${t.percentPL.toFixed(2)}%`
                  : "—";
              const premium =
                typeof t.premiumCaptured === "number"
                  ? formatUSD(t.premiumCaptured)
                  : "—";
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
                    <div className="text-xs text-muted-foreground">
                      {t.type}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Strike</span> $
                      {Number(t.strikePrice as number).toFixed(2)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Closed</span>{" "}
                      {closedDate ? closedDate.toLocaleDateString() : "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">% P/L</span>{" "}
                      {percent}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Premium</span>{" "}
                      {premium}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Desktop table (shown on md+) */}
        <div className="hidden md:block">
          <table className="min-w-full text-sm text-left text-gray-700 dark:text-gray-100">
            <thead className="bg-gray-100 dark:bg-gray-800">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-200 cursor-pointer select-none"
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
                    No trades have been closed yet.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/portfolio/${portfolioId}/trade/${row.original.id}`,
                      )
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}
