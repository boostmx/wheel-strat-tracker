"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { Portfolio } from "@/types";
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";
type Snapshot = {
  portfolioId: string;
  startingCapital: number;
  totalProfitAll: number;
  openCount: number;
  capitalInUse: number;
  cashAvailable: number;
  biggest: { ticker: string; strikePrice: number; contracts: number; collateral: number; expirationDate: string } | null;
  topTickers: { ticker: string; collateral: number; pct: number }[];
  nextExpiration: { date: string; contracts: number } | null;
  expiringSoonCount: number;
  openAvgDays: number | null;
  realizedMTD: number;
  realizedYTD: number;
} | null;

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
}
function formatLongCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
function pctColor(p: number) {
  if (p > 85) return "text-red-700";
  if (p >= 60) return "text-amber-700";
  return "text-green-700";
}

export default function MetricsContent() {
  const { data: portfolios = [], isLoading, error } = useSWR<Portfolio[]>("/api/portfolios");
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});

  useEffect(() => {
    (async () => {
      if (!portfolios?.length) return;
      const ids = portfolios.map(p => p.id);
      const res = await fetch("/api/portfolios/snapshot/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data: Record<string, Snapshot> = res.ok ? await res.json() : {};
      setSnapshots(data);
    })();
  }, [portfolios]);

  const agg = useMemo(() => {
    const snaps = Object.values(snapshots).filter(Boolean) as NonNullable<Snapshot>[];

    const accountStarting = snaps.reduce((s, n) => s + n.startingCapital, 0);
    const accountProfit = snaps.reduce((s, n) => s + n.totalProfitAll, 0);
    const accountCurrentCapital = accountStarting + accountProfit;
    const accountCapitalUsed = snaps.reduce((s, n) => s + n.capitalInUse, 0);
    const accountPercentUsed = accountCurrentCapital > 0 ? (accountCapitalUsed / accountCurrentCapital) * 100 : 0;
    const accountCashAvailable = accountCurrentCapital - accountCapitalUsed;

    const totalOpenTrades = snaps.reduce((s, n) => s + n.openCount, 0);
    const totalRealizedMTD = snaps.reduce((s, n) => s + n.realizedMTD, 0);
    const totalRealizedYTD = snaps.reduce((s, n) => s + n.realizedYTD, 0);
    const totalExpiringSoon = snaps.reduce((s, n) => s + n.expiringSoonCount, 0);

    // Next expiration across account
    let nextDate: string | null = null;
    const contractsByDate = new Map<string, number>();
    for (const n of snaps) {
      if (n.nextExpiration?.date) {
        const d = new Date(n.nextExpiration.date).toISOString().slice(0, 10);
        contractsByDate.set(d, (contractsByDate.get(d) ?? 0) + (n.nextExpiration.contracts || 0));
        if (!nextDate || d < nextDate) nextDate = d;
      }
    }
    const nextExpiration = nextDate ? { date: nextDate, contracts: contractsByDate.get(nextDate) ?? 0 } : null;

    // Top exposures (account)
    const byTicker = new Map<string, number>();
    for (const n of snaps) for (const t of n.topTickers) byTicker.set(t.ticker, (byTicker.get(t.ticker) ?? 0) + t.collateral);
    const totalColl = Array.from(byTicker.values()).reduce((a, b) => a + b, 0) || 1;
    const topExposures = Array.from(byTicker.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([ticker, coll]) => ({ ticker, pct: (coll / totalColl) * 100 }));

    // Per-portfolio chips
    const perPortfolio = snaps.map(n => {
      const current = n.startingCapital + n.totalProfitAll;
      const pctUsed = current > 0 ? (n.capitalInUse / current) * 100 : 0;
      return {
        id: n.portfolioId,
        pctUsed,
        open: n.openCount,
        soon: n.expiringSoonCount,
      };
    });

    return {
      accountStarting,
      accountProfit,
      accountCurrentCapital,
      accountCapitalUsed,
      accountPercentUsed,
      accountCashAvailable,
      totalOpenTrades,
      totalRealizedMTD,
      totalRealizedYTD,
      totalExpiringSoon,
      nextExpiration,
      topExposures,
      perPortfolio,
    };
  }, [snapshots]);

  if (isLoading) return <div className="max-w-5xl mx-auto py-16 px-6">Loading...</div>;
  if (error) return <div className="max-w-5xl mx-auto py-16 px-6 text-red-600">Failed to load portfolios.</div>;

  return (
    <div className="max-w-5xl mx-auto py-16 px-6 space-y-10">
      <h1 className="text-3xl font-bold text-gray-900">Account Snapshot</h1>

      {/* Row 1: Current, Used, Available */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white shadow-sm rounded-lg">
          <CardContent className="p-6">
            <p className="text-base font-medium text-gray-600">Current Capital (Account)</p>
            <p className="text-3xl font-bold text-gray-900">{formatLongCurrency(agg.accountCurrentCapital)}</p>
            <p className="mt-1 text-sm text-gray-500">
              {`Starting ${formatLongCurrency(agg.accountStarting)} · Realized ${formatCompactCurrency(agg.accountProfit)}`}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 rounded-lg">
          <CardContent className="p-6">
            <p className="text-base font-medium text-amber-700">Capital In Use</p>
            <p className="text-3xl font-bold text-amber-700">{formatLongCurrency(agg.accountCapitalUsed)}</p>
            <p className={`mt-1 text-sm font-semibold ${pctColor(agg.accountPercentUsed)}`}>
              {`% Used: ${agg.accountPercentUsed.toFixed(1)}%`}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 rounded-lg">
          <CardContent className="p-6">
            <p className="text-base font-medium text-green-700">Cash Available</p>
            <p className={`text-3xl font-bold ${agg.accountCashAvailable < 0 ? "text-red-700" : "text-green-700"}`}>
              {formatLongCurrency(agg.accountCashAvailable)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Ops view */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border rounded-lg">
          <CardContent className="p-6">
            <p className="text-base font-medium text-gray-600">Open Trades</p>
            <p className="text-3xl font-bold text-gray-900">{agg.totalOpenTrades}</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 rounded-lg">
          <CardContent className="p-6">
            <p className="text-base font-medium text-blue-700">Next Expiration</p>
            <p className="text-xl font-semibold text-blue-800">
              {agg.nextExpiration
                  ? `${formatDateOnlyUTC(agg.nextExpiration.date)} · ${agg.nextExpiration.contracts} contracts`
                  : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-rose-50 rounded-lg">
          <CardContent className="p-6">
            <p className="text-base font-medium text-rose-700">Expiring in 7 Days</p>
            <p className="text-3xl font-bold text-rose-700">{agg.totalExpiringSoon}</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: P&L + exposures */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border rounded-lg">
          <CardContent className="p-6">
            <p className="text-base font-medium text-gray-600">Realized P&L (MTD)</p>
            <p className="text-2xl font-bold text-gray-900">{formatCompactCurrency(agg.totalRealizedMTD)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border rounded-lg">
          <CardContent className="p-6">
            <p className="text-base font-medium text-gray-600">Realized P&L (YTD)</p>
            <p className="text-2xl font-bold text-gray-900">{formatCompactCurrency(agg.totalRealizedYTD)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border rounded-lg">
          <CardContent className="p-6">
            <p className="text-base font-medium text-gray-600">Top Exposures</p>
            <p className="text-base font-semibold text-gray-900">
              {agg.topExposures.length
                ? agg.topExposures.map(t => `${t.ticker} ${t.pct.toFixed(0)}%`).join(" · ")
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-portfolio chips */}
      <div className="mt-2">
        <p className="text-sm text-gray-500 mb-2">By portfolio</p>
        <div className="flex flex-wrap gap-2">
          {agg.perPortfolio.map((pp) => (
            <span
              key={pp.id}
              className={`text-xs px-2 py-1 rounded border bg-white ${pctColor(pp.pctUsed)}`}
              title={`% Used ${pp.pctUsed.toFixed(1)} · Open ${pp.open} · Exp ≤7d ${pp.soon}`}
            >
              {`${pp.id.slice(0, 4)}… · ${pp.pctUsed.toFixed(0)}% used · ${pp.open} open · ${pp.soon} ≤7d`}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}