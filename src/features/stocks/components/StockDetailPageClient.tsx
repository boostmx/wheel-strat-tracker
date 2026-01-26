"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
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
import { CloseStockLotModal } from "./CloseStockModal";
import { AddTradeModal } from "@/features/trades/components/AddTradeModal";

type StockResponse = { stockLot: StockLot };

type CoveredCallRow = {
  id: string;
  expirationDate: string | Date;
  strikePrice: number;
  contracts: number;
  status: string;
  premiumCaptured: number | null;
};

const fetcher = async (url: string): Promise<StockResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load stock");
  return (await res.json()) as StockResponse;
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

const coveredCallColumns: ColumnDef<CoveredCallRow>[] = [
  {
    accessorKey: "expirationDate",
    header: "Exp",
    cell: ({ row }) => {
      const d = row.original.expirationDate;
      return (
        <span className="font-medium">{new Date(d).toLocaleDateString()}</span>
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
    header: "Contracts",
    cell: ({ row }) => safeNumber(row.original.contracts),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={String(row.original.status)} />,
  },
  {
    accessorKey: "premiumCaptured",
    header: () => <div className="text-right">Premium Captured</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {typeof row.original.premiumCaptured === "number"
          ? money(row.original.premiumCaptured)
          : "—"}
      </div>
    ),
  },
];

export default function StockDetailPageClient(props: {
  portfolioId: string;
  stockId: string;
}) {
  const { portfolioId, stockId } = props;

  const [closeOpen, setCloseOpen] = React.useState<boolean>(false);

  const { data, error, isLoading } = useSWR<StockResponse>(
    `/api/stocks/${stockId}`,
    fetcher,
  );

  // IMPORTANT: hooks must run in the same order on every render.
  // So we compute memo/table using safe fallbacks BEFORE any early returns.
  const stockLot = data?.stockLot;

  const coveredCalls: CoveredCallRow[] = React.useMemo(() => {
    const trades = stockLot?.trades ?? [];
    return trades
      .filter((t) => t.type === "CoveredCall")
      .map((t) => ({
        id: t.id,
        expirationDate: t.expirationDate,
        strikePrice: safeNumber(t.strikePrice),
        contracts: safeNumber(t.contracts),
        status: String(t.status),
        premiumCaptured:
          typeof t.premiumCaptured === "number" ? t.premiumCaptured : null,
      }));
  }, [stockLot?.trades]);

  const table = useReactTable({
    data: coveredCalls,
    columns: coveredCallColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (error || !stockLot) {
    return (
      <div className="p-6 text-sm text-destructive">Failed to load stock.</div>
    );
  }

  const s = stockLot;
  const avg = toNumber(s.avgCost);
  const basis = avg * safeNumber(s.shares);
  const sharesForContracts = Math.floor(safeNumber(s.shares) / 100);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">
            <Link href={`/portfolios/${portfolioId}`} className="hover:underline">
              ← Back to Portfolio
            </Link>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight mt-2">
            {s.ticker}
          </h1>

          <div className="text-sm text-foreground space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Shares: {safeNumber(s.shares)}</span>
              <span className="text-border/60">•</span>
              <span>Avg Cost: {money(avg)}</span>
              <span className="text-border/60">•</span>
              <span>Cost Basis: {money(basis)}</span>
              <span className="text-border/60">•</span>
              <span className="inline-flex items-center gap-2">
                Status: <StatusBadge status={String(s.status)} />
              </span>
            </div>

            {String(s.status).toUpperCase() === "CLOSED" ? (
              <div>
                Realized P/L:{" "}
                <span className="font-medium">
                  {formatMoney(safeNumber(s.realizedPnl))}
                </span>
              </div>
            ) : null}
          </div>

          {s.notes ? (
            <p className="text-sm text-muted-foreground mt-2">{s.notes}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {String(s.status).toUpperCase() === "OPEN" ? (
            <>
              {sharesForContracts >= 1 ? (
                <AddTradeModal
                  portfolioId={portfolioId}
                  trigger={<Button variant="outline">Sell Covered Call</Button>}
                  prefill={{
                    ticker: s.ticker,
                    type: "CoveredCall",
                    stockLotId: s.id,
                    contracts: Math.max(1, sharesForContracts),
                  }}
                  lockPrefill
                />
              ) : null}

              <Button onClick={() => setCloseOpen(true)}>Close Stock Lot</Button>
            </>
          ) : null}
        </div>
      </div>

      <Card className="p-4">
        <h2 className="text-lg font-semibold">Covered Calls</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Covered calls sold against this stock lot.
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
                        (header.column.id === "premiumCaptured" ? "text-right" : "") +
                        (header.column.id === "expirationDate" ? " w-[140px]" : "")
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
                    colSpan={coveredCallColumns.length}
                    className="h-24 px-2 text-center text-sm text-muted-foreground"
                  >
                    No covered calls linked yet.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/60 hover:bg-muted/30"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={
                          "p-2 align-middle " +
                          (cell.column.id === "premiumCaptured" ? "text-right" : "")
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
          shares={safeNumber(s.shares)}
          avgCost={toNumber(s.avgCost)}
        />
      ) : null}
    </div>
  );
}