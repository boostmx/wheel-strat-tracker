"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import useSWR from "swr";
import { Trade, StockLot } from "@/types";
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

type StockLotLike = StockLot & {
  closedAt?: string | Date | null;
  openedAt?: string | Date | null;
  avgCost?: number | string | null;
  closePrice?: number | string | null;
  realizedPnl?: number | string | null;
  shares?: number | null;
};

type ClosedRow =
  | { kind: "trade"; id: string; item: TradeLike }
  | { kind: "stock"; id: string; item: StockLotLike };

type StocksApiResponse = {
  stockLots?: StockLotLike[];
  stocks?: StockLotLike[];
};

const fetcher = async (url: string): Promise<StocksApiResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as StocksApiResponse;
};

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


const getStockClosedDate = (s: StockLotLike): Date | undefined => {
  return toDate(s.closedAt) ?? toDate((s as StockLotLike).openedAt);
};

const computeStockPercentPl = (s: StockLotLike): number | null => {
  const pnl = toNumber(s.realizedPnl);
  const avg = toNumber(s.avgCost);
  const shares = toNumber(s.shares);
  const basis = avg * shares;
  if (basis <= 0) return null;
  return (pnl / basis) * 100;
};

export function ClosedTradesTable({
  trades,
  portfolioId,
}: {
  trades: Trade[];
  portfolioId: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const router = useRouter();

  const closedStocksKey = `/api/stocks?portfolioId=${encodeURIComponent(
    portfolioId,
  )}&status=closed`;

  const { data: closedStocksData } = useSWR<StocksApiResponse>(
    closedStocksKey,
    fetcher,
  );

  const closedStockLots: StockLotLike[] =
    (closedStocksData?.stockLots ?? closedStocksData?.stocks ?? []) || [];

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

  const filteredRows = useMemo(() => {
    const start = getStartDate(timeframe);

    const tradeRows: ClosedRow[] = trades.map((t) => ({
      kind: "trade",
      id: t.id,
      item: t as TradeLike,
    }));

    const stockRows: ClosedRow[] = closedStockLots.map((s) => ({
      kind: "stock",
      id: s.id,
      item: s,
    }));

    const all = [...tradeRows, ...stockRows];

    const withinTimeframe = start
      ? all.filter((r) => {
          const d =
            r.kind === "trade"
              ? getTradeClosedDate(r.item)
              : getStockClosedDate(r.item);
          if (!d) return true;
          return d >= start;
        })
      : all;

    // Sort newest-first by closed date
    return withinTimeframe.sort((a, b) => {
      const da =
        a.kind === "trade"
          ? getTradeClosedDate(a.item)
          : getStockClosedDate(a.item);
      const db =
        b.kind === "trade"
          ? getTradeClosedDate(b.item)
          : getStockClosedDate(b.item);
      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      return tb - ta;
    });
  }, [trades, closedStockLots, timeframe]);

  // Reset to first page when filters or page size change
  useEffect(() => {
    setPageIndex(0);
  }, [timeframe, pageSize]);


  const columns = useMemo<ColumnDef<ClosedRow>[]>(() => {
    return [
      {
        header: "Ticker",
        accessorFn: (r) =>
          r.kind === "trade"
            ? (r.item as TradeLike).ticker
            : (r.item as StockLotLike).ticker,
        cell: ({ row }) => {
          const r = row.original;
          const ticker =
            r.kind === "trade"
              ? (r.item as TradeLike).ticker
              : (r.item as StockLotLike).ticker;
          return <span className="font-semibold">{ticker}</span>;
        },
      },
      {
        header: "Type",
        accessorFn: (r) => (r.kind === "trade" ? (r.item as TradeLike).type : "Shares"),
        cell: ({ row }) => {
          const r = row.original;
          return r.kind === "trade"
            ? <TypeBadge type={String((r.item as TradeLike).type)} />
            : <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-muted text-muted-foreground">Shares</span>;
        },
      },
      {
        header: "Strike / Cost",
        accessorFn: (r) =>
          r.kind === "trade"
            ? Number((r.item as TradeLike).strikePrice ?? 0)
            : toNumber((r.item as StockLotLike).avgCost),
        cell: ({ row }) => {
          const r = row.original;
          if (r.kind === "trade") {
            const strike = Number((r.item as TradeLike).strikePrice ?? 0);
            return <span className="tabular-nums">{formatUSD(strike)}</span>;
          }
          const avg = toNumber((r.item as StockLotLike).avgCost);
          return (
            <div>
              <div className="tabular-nums">{formatUSD(avg)}</div>
              <div className="text-xs text-muted-foreground">avg cost</div>
            </div>
          );
        },
        meta: { align: "right" },
      },
      {
        header: "Qty",
        accessorFn: (r) =>
          r.kind === "trade"
            ? ((r.item as TradeLike).contractsInitial ?? (r.item as TradeLike).contracts ?? 0)
            : toNumber((r.item as StockLotLike).shares),
        cell: ({ row }) => {
          const r = row.original;
          if (r.kind === "trade") {
            const t = r.item as TradeLike;
            const qty = t.contractsInitial ?? t.contracts ?? 0;
            return (
              <div>
                <div>{qty}</div>
                <div className="text-xs text-muted-foreground">contract{qty === 1 ? "" : "s"}</div>
              </div>
            );
          }
          const shares = toNumber((r.item as StockLotLike).shares);
          return (
            <div>
              <div>{shares}</div>
              <div className="text-xs text-muted-foreground">shares</div>
            </div>
          );
        },
        meta: { align: "right" },
      },
      {
        header: "P/L",
        accessorFn: (r) => {
          if (r.kind === "trade") return toNumber((r.item as TradeLike).premiumCaptured);
          return toNumber((r.item as StockLotLike).realizedPnl);
        },
        cell: ({ row }) => {
          const r = row.original;
          const dollars =
            r.kind === "trade"
              ? toNumber((r.item as TradeLike).premiumCaptured)
              : toNumber((r.item as StockLotLike).realizedPnl);
          const pct =
            r.kind === "trade"
              ? computePercentPl(r.item as TradeLike)
              : computeStockPercentPl(r.item as StockLotLike);
          return (
            <div>
              <div className={`tabular-nums font-medium ${plClass(dollars)}`}>
                {formatUSD(dollars)}
              </div>
              {pct !== null && (
                <div className={`text-xs tabular-nums ${plClass(pct)}`}>
                  {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                </div>
              )}
            </div>
          );
        },
        meta: { align: "right" },
      },
      {
        header: "Closed",
        accessorFn: (r) => {
          const d =
            r.kind === "trade"
              ? getTradeClosedDate(r.item)
              : getStockClosedDate(r.item as StockLotLike);
          return d ? d.getTime() : 0;
        },
        cell: ({ row }) => {
          const r = row.original;
          const d =
            r.kind === "trade"
              ? getTradeClosedDate(r.item)
              : getStockClosedDate(r.item as StockLotLike);
          return (
            <span className="text-muted-foreground tabular-nums">
              {d ? formatDateOnlyUTC(d) : "—"}
            </span>
          );
        },
      },
    ];
  }, []);

  const table = useReactTable({
    data: filteredRows,
    columns,
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
    const originals = allRows.map((r) => r.original as ClosedRow);
    const count = originals.length;

    const percentVals: number[] = originals
      .map((r) =>
        r.kind === "trade"
          ? computePercentPl(r.item as TradeLike)
          : computeStockPercentPl(r.item as StockLotLike),
      )
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    const avgPercentPL = percentVals.length
      ? percentVals.reduce((a, b) => a + b, 0) / percentVals.length
      : null;

    const premiumVals: number[] = originals
      .map((r) => {
        if (r.kind === "trade") {
          const t = r.item as TradeLike;
          return typeof t.premiumCaptured === "number" ? t.premiumCaptured : undefined;
        }
        return toNumber((r.item as StockLotLike).realizedPnl);
      })
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    const totalPremiumCaptured = premiumVals.length
      ? premiumVals.reduce((a, b) => a + b, 0)
      : null;

    return { count, avgPercentPL, totalPremiumCaptured };
  }, [allRows]);

  return (
    <div className="w-full">
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
      <div className="mb-3 px-4 pt-4 hidden md:flex md:flex-row md:items-center md:justify-between">
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
              No trades or stock lots have been closed yet.
            </div>
          ) : (
            pageRows.map((row) => {
              const r = row.original as ClosedRow;

              const ticker =
                r.kind === "trade"
                  ? (r.item as TradeLike).ticker
                  : (r.item as StockLotLike).ticker;

              const closedDate =
                r.kind === "trade"
                  ? getTradeClosedDate(r.item as TradeLike)
                  : getStockClosedDate(r.item as StockLotLike);

              const premium =
                r.kind === "trade"
                  ? typeof (r.item as TradeLike).premiumCaptured === "number"
                    ? formatUSD((r.item as TradeLike).premiumCaptured as number)
                    : "—"
                  : formatUSD(toNumber((r.item as StockLotLike).realizedPnl));

              const pct =
                r.kind === "trade"
                  ? computePercentPl(r.item as TradeLike)
                  : computeStockPercentPl(r.item as StockLotLike);

              const pctLabel = pct !== null ? `${pct.toFixed(2)}%` : "—";

              return (
                <button
                  key={`${r.kind}-${r.id}`}
                  onClick={() =>
                    router.push(
                      r.kind === "trade"
                        ? `/portfolios/${portfolioId}/trades/${r.id}`
                        : `/portfolios/${portfolioId}/stocks/${r.id}`,
                    )
                  }
                  className="w-full text-left rounded-xl border p-3 bg-card hover:bg-accent transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{ticker}</div>
                    {r.kind === "trade"
                      ? <TypeBadge type={String((r.item as TradeLike).type)} />
                      : <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-muted text-muted-foreground">Shares</span>
                    }
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Closed</div>
                      <div>{closedDate ? formatDateOnlyUTC(closedDate) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">P/L</div>
                      <div className={`font-medium ${plClass(r.kind === "trade" ? toNumber((r.item as TradeLike).premiumCaptured) : toNumber((r.item as StockLotLike).realizedPnl))}`}>
                        {premium}
                      </div>
                      {pct !== null && (
                        <div className={`text-xs ${plClass(pct)}`}>
                          {pct >= 0 ? "+" : ""}{pctLabel}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {r.kind === "trade" ? "Strike" : "Avg Cost"}
                      </div>
                      <div className="tabular-nums">
                        {r.kind === "trade"
                          ? formatUSD(Number((r.item as TradeLike).strikePrice ?? 0))
                          : formatUSD(toNumber((r.item as StockLotLike).avgCost))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {r.kind === "trade" ? "Contracts" : "Shares"}
                      </div>
                      <div>
                        {r.kind === "trade"
                          ? ((r.item as TradeLike).contractsInitial ?? (r.item as TradeLike).contracts ?? 0)
                          : toNumber((r.item as StockLotLike).shares)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Desktop table (shown on md+) */}
        <div className="hidden md:block">
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
                    No trades or stock lots have been closed yet.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={row.id}
                    className="group border-b border-border/40 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => {
                      const r = row.original as ClosedRow;
                      router.push(
                        r.kind === "trade"
                          ? `/portfolios/${portfolioId}/trades/${r.id}`
                          : `/portfolios/${portfolioId}/stocks/${r.id}`,
                      );
                    }}
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
    </div>
  );
}
