"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type { StockLot } from "@/types";
import type { QuoteResult } from "@/app/api/quotes/route";
import { CloseStockLotModal } from "./CloseStockModal";
import { AddTradeModal } from "@/features/trades/components/AddTradeModal";

type StockResponse = { stockLot: StockLot };

type CoveredCallRow = {
  id: string;
  expirationDate: string | Date;
  strikePrice: number;
  contracts: number;
  contractPrice: number;
  status: string;
  premiumCaptured: number | null;
  openedAt: string;
  closedAt: string | null;
};

type AvgCostSnapshot = { before: number; after: number };

function buildAvgCostHistory(
  coveredCalls: CoveredCallRow[],
  currentAvg: number,
  shares: number,
): Record<string, AvgCostSnapshot> {
  const closed = coveredCalls
    .filter((cc) => cc.status.toLowerCase() !== "open" && cc.premiumCaptured != null)
    .sort((a, b) => {
      const ta = a.closedAt ? new Date(a.closedAt).getTime() : 0;
      const tb = b.closedAt ? new Date(b.closedAt).getTime() : 0;
      return ta - tb;
    });

  const totalCaptured = closed.reduce((s, cc) => s + (cc.premiumCaptured ?? 0), 0);
  let running = shares > 0 ? currentAvg + totalCaptured / shares : currentAvg;

  const history: Record<string, AvgCostSnapshot> = {};
  for (const cc of closed) {
    const reduction = shares > 0 ? (cc.premiumCaptured ?? 0) / shares : 0;
    history[cc.id] = { before: running, after: running - reduction };
    running -= reduction;
  }
  return history;
}

const fetcher = async (url: string): Promise<StockResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load stock");
  return (await res.json()) as StockResponse;
};

const quoteFetcher = async (url: string): Promise<Record<string, QuoteResult>> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json() as Promise<Record<string, QuoteResult>>;
};

function toNumber(v: string | number): number {
  return typeof v === "number" ? v : Number(v);
}

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function moneyCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return money(n);
}

function formatStrike(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function daysUntil(date: string | Date): number {
  const exp = new Date(date);
  exp.setHours(23, 59, 59, 0);
  const now = new Date();
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function StatusBadge(props: { status: string }) {
  const s = (props.status ?? "").toUpperCase();
  const isOpen = s === "OPEN";
  const label = isOpen ? "Open" : "Closed";

  return (
    <Badge
      variant="secondary"
      className={
        isOpen
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
          : "bg-muted text-muted-foreground border border-border/60"
      }
    >
      {label}
    </Badge>
  );
}


function LotStat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "danger";
}) {
  const valueColor =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${valueColor}`}>{value}</div>
      {sub ? <div className="text-xs text-muted-foreground mt-0.5">{sub}</div> : null}
    </div>
  );
}

function buildColumns(
  portfolioId: string,
  shares: number,
  router: ReturnType<typeof useRouter>,
  avgCostHistory: Record<string, AvgCostSnapshot>,
  currentAvg: number,
): ColumnDef<CoveredCallRow>[] {
  return [
    {
      accessorKey: "expirationDate",
      header: "Exp",
      cell: ({ row }) => {
        const d = row.original.expirationDate;
        const isOpen = row.original.status.toLowerCase() === "open";
        const dte = daysUntil(d);
        return (
          <div>
            <div className="font-medium">{new Date(d).toLocaleDateString()}</div>
            {isOpen ? (
              <div
                className={`text-xs tabular-nums ${dte <= 7 ? "text-rose-500" : dte <= 21 ? "text-amber-500" : "text-muted-foreground"}`}
              >
                {dte > 0 ? `${dte}d` : dte === 0 ? "exp today" : "expired"}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: "strikePrice",
      header: "Strike",
      cell: ({ row }) => formatStrike(safeNumber(row.original.strikePrice)),
    },
    {
      accessorKey: "contracts",
      header: "Qty",
      cell: ({ row }) => safeNumber(row.original.contracts),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={String(row.original.status)} />,
    },
    {
      id: "costImpact",
      header: () => <div className="text-right">Avg Cost</div>,
      cell: ({ row }) => {
        const { id, status, contractPrice, contracts, premiumCaptured } =
          row.original;
        const isOpen = status.toLowerCase() === "open";

        if (isOpen) {
          const potential = (contractPrice * 100 * contracts) / shares;
          const projected = currentAvg - potential;
          return (
            <div className="text-right tabular-nums text-xs space-y-0.5">
              <div className="text-muted-foreground">{moneyCompact(currentAvg)}</div>
              <div className="text-emerald-600 dark:text-emerald-400">
                → ~{moneyCompact(projected)}
              </div>
            </div>
          );
        }

        const snap = avgCostHistory[id];
        const captured = premiumCaptured ?? 0;
        const perShare = shares > 0 ? captured / shares : 0;

        return (
          <div className="text-right tabular-nums text-xs space-y-0.5">
            {snap ? (
              <>
                <div className="text-muted-foreground line-through">{moneyCompact(snap.before)}</div>
                <div className="text-emerald-600 dark:text-emerald-400">→ {moneyCompact(snap.after)}</div>
              </>
            ) : (
              <div className="text-emerald-600 dark:text-emerald-400">-{moneyCompact(perShare)}/sh</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "premiumCaptured",
      header: () => <div className="text-right">Premium</div>,
      cell: ({ row }) => {
        const { status, contractPrice, contracts, premiumCaptured } =
          row.original;
        const isOpen = status.toLowerCase() === "open";

        if (isOpen) {
          const potential = contractPrice * 100 * contracts;
          return (
            <div className="text-right tabular-nums text-muted-foreground text-xs">
              ~{money(potential)}
            </div>
          );
        }

        const maxPremium =
          contractPrice > 0 ? contractPrice * 100 * contracts : null;
        const captured = premiumCaptured ?? 0;
        const pct =
          maxPremium && maxPremium > 0
            ? Math.round((captured / maxPremium) * 100)
            : null;
        const color =
          captured > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : captured < 0
              ? "text-rose-600 dark:text-rose-400"
              : "";

        return (
          <div className={`text-right tabular-nums ${color}`}>
            <div>{money(captured)}</div>
            {pct !== null ? (
              <div className="text-xs text-muted-foreground">{pct}% of max</div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "link",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(
              `/portfolios/${portfolioId}/trades/${row.original.id}`,
            );
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
          aria-label="View position"
        >
          →
        </button>
      ),
    },
  ];
}

export default function StockDetailPageClient(props: {
  portfolioId: string;
  stockId: string;
}) {
  const { portfolioId, stockId } = props;
  const router = useRouter();

  const [closeOpen, setCloseOpen] = React.useState<boolean>(false);

  const { data, error, isLoading } = useSWR<StockResponse>(
    `/api/stocks/${stockId}`,
    fetcher,
  );

  const stockLot = data?.stockLot;

  const coveredCalls: CoveredCallRow[] = React.useMemo(() => {
    const trades = stockLot?.trades ?? [];
    return trades
      .filter((t) => t.type === "CoveredCall")
      .map((t) => ({
        id: t.id,
        expirationDate: t.expirationDate,
        strikePrice: safeNumber(t.strikePrice),
        contracts: safeNumber(t.contracts ?? t.contractsInitial),
        contractPrice: safeNumber(t.contractPrice),
        status: String(t.status),
        premiumCaptured:
          typeof t.premiumCaptured === "number" ? t.premiumCaptured : null,
        openedAt: t.createdAt,
        closedAt: t.closedAt ?? null,
      }));
  }, [stockLot?.trades]);

  const shares = safeNumber(stockLot?.shares ?? 0);
  const avg = toNumber(stockLot?.avgCost ?? 0);

  const { data: quoteData } = useSWR<Record<string, QuoteResult>>(
    stockLot?.ticker ? `/api/quotes?tickers=${stockLot.ticker}` : null,
    quoteFetcher,
    { refreshInterval: 60_000, dedupingInterval: 30_000 },
  );
  const quote = stockLot?.ticker ? quoteData?.[stockLot.ticker] : undefined;

  const avgCostHistory = React.useMemo(
    () => buildAvgCostHistory(coveredCalls, avg, shares),
    [coveredCalls, avg, shares],
  );

  const columns = React.useMemo(
    () => buildColumns(portfolioId, shares, router, avgCostHistory, avg),
    [portfolioId, shares, router, avgCostHistory, avg],
  );

  const table = useReactTable({
    data: coveredCalls,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // CC summary metrics
  const ccMetrics = React.useMemo(() => {
    const closed = coveredCalls.filter(
      (cc) => cc.status.toLowerCase() !== "open",
    );
    const open = coveredCalls.filter(
      (cc) => cc.status.toLowerCase() === "open",
    );

    const totalCaptured = closed.reduce(
      (sum, cc) => sum + (cc.premiumCaptured ?? 0),
      0,
    );
    const pendingPremium = open.reduce(
      (sum, cc) => sum + cc.contractPrice * 100 * cc.contracts,
      0,
    );

    return { totalCaptured, pendingPremium, openCount: open.length, closedCount: closed.length };
  }, [coveredCalls]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (error || !stockLot) {
    return (
      <div className="p-6 text-sm text-destructive">Failed to load stock.</div>
    );
  }

  const s = stockLot;
  const basis = avg * shares;
  const sharesForContracts = Math.floor(shares / 100);

  const { totalCaptured, pendingPremium, closedCount } = ccMetrics;
  const originalAvg =
    totalCaptured > 0 ? avg + totalCaptured / shares : null;
  const adjAvgIfAllCapture =
    pendingPremium > 0 ? avg - pendingPremium / shares : null;

  const isClosed = String(s.status).toUpperCase() === "CLOSED";
  const realizedPnl = safeNumber(s.realizedPnl);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/portfolios/${portfolioId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Portfolio
        </Link>

        <div className="flex items-center gap-2">
          {!isClosed && sharesForContracts >= 1 ? (
            <AddTradeModal
              portfolioId={portfolioId}
              trigger={<Button variant="outline" size="sm">Sell Covered Call</Button>}
              prefill={{
                ticker: s.ticker,
                type: "CoveredCall",
                stockLotId: s.id,
                contracts: Math.max(1, sharesForContracts),
              }}
              lockPrefill
            />
          ) : null}
          {!isClosed ? (
            <Button size="sm" onClick={() => setCloseOpen(true)}>Close Stock Lot</Button>
          ) : null}
        </div>
      </div>

      {/* Ticker + status */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{s.ticker}</h1>
        <StatusBadge status={String(s.status)} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <LotStat label="Shares" value={String(shares)} />
        <LotStat label="Avg Cost / Share" value={moneyCompact(avg)} />
        <LotStat label="Total Cost Basis" value={money(basis)} />
        <LotStat
          label="Opened"
          value={new Date(s.openedAt).toLocaleDateString()}
        />
        <LotStat
          label={
            quote?.marketState && quote.marketState !== "REGULAR"
              ? quote.marketState === "PRE"
                ? "Pre-Market"
                : quote.marketState === "POST" || quote.marketState === "POSTPOST"
                  ? "After Hours"
                  : "Last Close"
              : "Live Price"
          }
          value={quote?.price != null ? moneyCompact(quote.price) : "—"}
          sub={
            quote?.change != null && quote?.changePct != null
              ? `${quote.change >= 0 ? "+" : ""}${moneyCompact(quote.change)} (${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%)`
              : undefined
          }
          tone={
            quote?.change == null ? "default" : quote.change > 0 ? "success" : quote.change < 0 ? "danger" : "default"
          }
        />
        {isClosed ? (
          <>
            <LotStat
              label="Close Price"
              value={s.closePrice != null ? moneyCompact(toNumber(s.closePrice)) : "—"}
            />
            <LotStat
              label="Realized P/L"
              value={formatMoney(realizedPnl)}
              tone={realizedPnl > 0 ? "success" : realizedPnl < 0 ? "danger" : "default"}
            />
            <LotStat
              label="Closed"
              value={s.closedAt ? new Date(s.closedAt).toLocaleDateString() : "—"}
            />
          </>
        ) : null}
      </div>

      {/* CC Cost-Basis Summary */}
      {coveredCalls.length > 0 || s.notes ? (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Cost Basis via Covered Calls
            </h2>
            {closedCount > 0 ? (
              <span className="text-xs text-muted-foreground">
                {closedCount} CC{closedCount !== 1 ? "s" : ""} closed
              </span>
            ) : null}
          </div>

          {totalCaptured === 0 && adjAvgIfAllCapture === null ? (
            <p className="text-sm text-muted-foreground">
              Close covered calls to see cost basis reduction here.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {originalAvg !== null ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Original Avg</div>
                  <div className="text-xl font-bold tabular-nums text-muted-foreground">
                    {moneyCompact(originalAvg)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">before premiums</div>
                </div>
              ) : null}

              <div>
                <div className="text-xs text-muted-foreground mb-1">Current Avg</div>
                <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {moneyCompact(avg)}
                </div>
                {originalAvg !== null ? (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {((1 - avg / originalAvg) * 100).toFixed(1)}% lower
                  </div>
                ) : null}
              </div>

              {totalCaptured > 0 ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total Captured</div>
                  <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {money(totalCaptured)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    -{moneyCompact(totalCaptured / shares)}/share
                  </div>
                </div>
              ) : null}

              {adjAvgIfAllCapture !== null ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">If Open CCs Expire</div>
                  <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {moneyCompact(adjAvgIfAllCapture)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {money(pendingPremium)} pending
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {s.notes ? (
            <div className={coveredCalls.length > 0 ? "mt-4 pt-4 border-t border-border/60" : ""}>
              <div className="text-xs text-muted-foreground mb-1">Notes</div>
              <p className="text-sm">{s.notes}</p>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="p-4">
        <h2 className="text-lg font-semibold">Covered Calls</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Covered calls sold against this stock lot. Click a row to view the position.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border/60">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={
                        "h-10 px-2 text-left align-middle font-medium text-muted-foreground " +
                        (header.column.id === "premiumCaptured" ||
                        header.column.id === "costImpact"
                          ? "text-right"
                          : "") +
                        (header.column.id === "expirationDate"
                          ? " w-[140px]"
                          : "")
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr className="border-b border-border/60">
                  <td
                    colSpan={columns.length}
                    className="h-24 px-2 text-center text-sm text-muted-foreground"
                  >
                    No covered calls linked yet.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/60 hover:bg-muted/30 cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/portfolios/${portfolioId}/trades/${row.original.id}`,
                      )
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={
                          "p-2 align-middle " +
                          (cell.column.id === "premiumCaptured" ||
                          cell.column.id === "costImpact"
                            ? "text-right"
                            : "")
                        }
                      >
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
      </Card>

      {String(s.status).toUpperCase() === "OPEN" ? (
        <CloseStockLotModal
          open={closeOpen}
          onOpenChange={setCloseOpen}
          stockId={stockId}
          portfolioId={portfolioId}
          ticker={s.ticker}
          shares={shares}
          avgCost={toNumber(s.avgCost)}
        />
      ) : null}
    </div>
  );
}
