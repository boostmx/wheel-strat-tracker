"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StockLot } from "@/types";
import { CloseStockLotModal } from "./CloseStockModal";

type StockResponse = { stockLot: StockLot };

const fetcher = async (url: string): Promise<StockResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load stock");
  return (await res.json()) as StockResponse;
};

function toNumber(v: string | number): number {
  return typeof v === "number" ? v : Number(v);
}

function money(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return money(n);
}

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

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (error || !data) return <div className="p-6 text-sm text-destructive">Failed to load stock.</div>;

  const s = data.stockLot;
  const avg = toNumber(s.avgCost);
  const basis = avg * s.shares;

  const coveredCalls = (s.trades ?? []).filter((t) => t.type === "CoveredCall");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">
            <Link href={`/portfolios/${portfolioId}`} className="hover:underline">
              ← Back to Portfolio
            </Link>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">{s.ticker}</h1>
          <p className="text-sm text-muted-foreground">
            Shares: {s.shares} • Avg Cost: {money(avg)} • Cost Basis: {money(basis)} • Status: {s.status}
            {s.status === "CLOSED" ? (
              <> • Realized P/L: {formatMoney(safeNumber(s.realizedPnl))}</>
            ) : null}
          </p>
          {s.notes ? <p className="text-sm text-muted-foreground mt-2">{s.notes}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          {s.status === "OPEN" ? (
            <Button onClick={() => setCloseOpen(true)}>Close Stock Lot</Button>
          ) : null}

          <Button variant="secondary" disabled>
            Sell Covered Call (soon)
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <h2 className="text-lg font-semibold">Covered Calls</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Only trades linked to this stock lot (via stockLotId).
        </p>

        {coveredCalls.length === 0 ? (
          <div className="text-sm text-muted-foreground">No covered calls linked yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="py-3 px-3 text-left font-medium">Exp</th>
                  <th className="py-3 px-3 text-left font-medium">Strike</th>
                  <th className="py-3 px-3 text-left font-medium">Contracts</th>
                  <th className="py-3 px-3 text-left font-medium">Status</th>
                  <th className="py-3 px-3 text-left font-medium">Premium Captured</th>
                </tr>
              </thead>
              <tbody>
                {coveredCalls.map((t) => (
                  <tr key={t.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-3 px-3">{new Date(t.expirationDate).toLocaleDateString()}</td>
                    <td className="py-3 px-3">{t.strikePrice}</td>
                    <td className="py-3 px-3">{t.contracts}</td>
                    <td className="py-3 px-3">{t.status}</td>
                    <td className="py-3 px-3">
                      {typeof t.premiumCaptured === "number" ? money(t.premiumCaptured) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {s.status === "OPEN" ? (
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