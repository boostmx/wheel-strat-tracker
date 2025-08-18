"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { Portfolio } from "@/types";
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";
import { motion } from "framer-motion";
type Snapshot = {
  portfolioId: string;
  startingCapital: number;
  additionalCapital: number; // NEW
  capitalBase: number;       // NEW: starting + additional
  currentCapital: number;    // NEW: capitalBase + totalProfitAll (realized)
  totalProfitAll: number;
  openCount: number;
  capitalInUse: number;
  cashAvailable: number;
  biggest: {
    ticker: string;
    strikePrice: number;
    contracts: number;
    collateral: number;
    expirationDate: string;
  } | null;
  topTickers: { ticker: string; collateral: number; pct: number }[];
  nextExpiration: { date: string; contracts: number } | null;
  expiringSoonCount: number;
  openAvgDays: number | null;
  realizedMTD: number;
  realizedYTD: number;
} | null;

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}
function formatLongCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
function pctColor(p: number) {
  if (p > 85) return "text-red-700";
  if (p >= 60) return "text-amber-700";
  return "text-green-700";
}

export default function AccountSummaryContent() {
  const {
    data: portfolios = [],
    isLoading,
    error,
  } = useSWR<Portfolio[]>("/api/portfolios");
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});

  useEffect(() => {
    (async () => {
      if (!portfolios?.length) return;
      const ids = portfolios.map((p) => p.id);
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
    const snaps = Object.values(snapshots).filter(
      Boolean,
    ) as NonNullable<Snapshot>[];

    const accountStarting = snaps.reduce((s, n) => s + n.startingCapital, 0);
    const accountAdditional = snaps.reduce((s, n) => s + n.additionalCapital, 0);
    const accountBase = snaps.reduce((s, n) => s + n.capitalBase, 0); // starting + additional
    const accountProfit = snaps.reduce((s, n) => s + n.totalProfitAll, 0);
    const accountCurrentCapital = accountBase + accountProfit; // realized P&L adjusts cash
    const accountCapitalUsed = snaps.reduce((s, n) => s + n.capitalInUse, 0);
    const accountPercentUsed = accountBase > 0 ? (accountCapitalUsed / accountBase) * 100 : 0;
    const accountCashAvailable = accountCurrentCapital - accountCapitalUsed;

    const totalOpenTrades = snaps.reduce((s, n) => s + n.openCount, 0);
    const totalRealizedMTD = snaps.reduce((s, n) => s + n.realizedMTD, 0);
    const totalRealizedYTD = snaps.reduce((s, n) => s + n.realizedYTD, 0);
    const totalExpiringSoon = snaps.reduce(
      (s, n) => s + n.expiringSoonCount,
      0,
    );

    // Next expiration across account
    let nextDate: string | null = null;
    const contractsByDate = new Map<string, number>();
    for (const n of snaps) {
      if (n.nextExpiration?.date) {
        const d = new Date(n.nextExpiration.date).toISOString().slice(0, 10);
        contractsByDate.set(
          d,
          (contractsByDate.get(d) ?? 0) + (n.nextExpiration.contracts || 0),
        );
        if (!nextDate || d < nextDate) nextDate = d;
      }
    }
    const nextExpiration = nextDate
      ? { date: nextDate, contracts: contractsByDate.get(nextDate) ?? 0 }
      : null;

    // Top exposures (account)
    const byTicker = new Map<string, number>();
    for (const n of snaps)
      for (const t of n.topTickers)
        byTicker.set(t.ticker, (byTicker.get(t.ticker) ?? 0) + t.collateral);
    const totalColl =
      Array.from(byTicker.values()).reduce((a, b) => a + b, 0) || 1;
    const topExposures = Array.from(byTicker.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ticker, coll]) => ({ ticker, pct: (coll / totalColl) * 100 }));

    // Per-portfolio chips
    const perPortfolio = snaps.map((n) => {
      const pctUsed = n.capitalBase > 0 ? (n.capitalInUse / n.capitalBase) * 100 : 0;
      return {
        id: n.portfolioId,
        pctUsed,
        open: n.openCount,
        soon: n.expiringSoonCount,
      };
    });

    return {
      accountStarting,
      accountAdditional,
      accountBase,
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

  if (isLoading)
    return <div className="max-w-5xl mx-auto py-16 px-6">Loading...</div>;
  if (error)
    return (
      <div className="max-w-5xl mx-auto py-16 px-6 text-red-600">
        Failed to load portfolios.
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto py-16 px-6 space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{ willChange: "opacity, transform" }}
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Account Summary
        </h1>
      </motion.div>

      {/* Row 1: Current, Used, Available */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch auto-rows-fr">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.04 }}
          whileHover={{ y: -2 }}
          style={{ willChange: "opacity, transform" }}
        >
          <Card className="bg-white dark:bg-gray-800 shadow-sm rounded-lg h-full">
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                Current Capital (Account)
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {formatLongCurrency(agg.accountCurrentCapital)}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {`Base ${formatLongCurrency(agg.accountBase)} (Start ${formatLongCurrency(agg.accountStarting)} · Addl ${formatLongCurrency(agg.accountAdditional)})`}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {`Realized ${formatCompactCurrency(agg.accountProfit)}`}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.08 }}
          whileHover={{ y: -2 }}
          style={{ willChange: "opacity, transform" }}
        >
          <Card className="bg-amber-50 dark:bg-amber-900 rounded-lg h-full">
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <p className="text-base font-medium text-amber-700 dark:text-amber-100">
                Capital In Use
              </p>
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-100">
                {formatLongCurrency(agg.accountCapitalUsed)}
              </p>
              <p
                className={`mt-1 text-sm font-semibold ${pctColor(agg.accountPercentUsed)}`}
              >
                {`% Used: ${agg.accountPercentUsed.toFixed(1)}%`}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.12 }}
          whileHover={{ y: -2 }}
          style={{ willChange: "opacity, transform" }}
        >
          <Card className="bg-green-50 dark:bg-green-900 rounded-lg h-full">
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <p className="text-base font-medium text-green-700 dark:text-green-100">
                Cash Available
              </p>
              <p
                className={`text-3xl font-bold ${agg.accountCashAvailable < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-100"}`}
              >
                {formatLongCurrency(agg.accountCashAvailable)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Row 2: Ops view */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch auto-rows-fr">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.16 }}
          whileHover={{ y: -2 }}
          style={{ willChange: "opacity, transform" }}
        >
          <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg h-full">
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                Open Trades
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {agg.totalOpenTrades}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.2 }}
          whileHover={{ y: -2 }}
          style={{ willChange: "opacity, transform" }}
        >
          <Card className="bg-blue-50 dark:bg-blue-900 rounded-lg h-full">
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <p className="text-base font-medium text-blue-700 dark:text-blue-100">
                Next Expiration
              </p>
              <p className="text-xl font-semibold text-blue-800 dark:text-blue-200">
                {agg.nextExpiration
                  ? `${formatDateOnlyUTC(agg.nextExpiration.date)} · ${agg.nextExpiration.contracts} contracts`
                  : "—"}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.24 }}
          whileHover={{ y: -2 }}
          style={{ willChange: "opacity, transform" }}
        >
          <Card className="bg-rose-50 dark:bg-rose-900 rounded-lg h-full">
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <p className="text-base font-medium text-rose-700 dark:text-rose-100">
                Expiring in 7 Days
              </p>
              <p className="text-3xl font-bold text-rose-700 dark:text-rose-100">
                {agg.totalExpiringSoon}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Row 3: P&L + exposures */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch auto-rows-fr">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.28 }}
          whileHover={{ y: -2 }}
          style={{ willChange: "opacity, transform" }}
        >
          <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg h-full">
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                Realized P&L (MTD)
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCompactCurrency(agg.totalRealizedMTD)}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.32 }}
          whileHover={{ y: -2 }}
          style={{ willChange: "opacity, transform" }}
        >
          <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg h-full">
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                Realized P&L (YTD)
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCompactCurrency(agg.totalRealizedYTD)}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.36 }}
          whileHover={{ y: -2 }}
          style={{ willChange: "opacity, transform" }}
        >
          <Card className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg h-full">
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                Top Exposures
              </p>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {agg.topExposures.length
                  ? agg.topExposures
                      .map((t) => `${t.ticker} ${t.pct.toFixed(0)}%`)
                      .join(" · ")
                  : "—"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Per-portfolio chips */}
      <motion.div
        className="mt-2"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.42 }}
        style={{ willChange: "opacity, transform" }}
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          By portfolio
        </p>
        <div className="flex flex-wrap gap-2 bg-white dark:bg-gray-800 p-2 rounded">
          {agg.perPortfolio.map((pp, i) => (
            <motion.span
              key={pp.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.02 * i }}
              className={`text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 ${pctColor(pp.pctUsed)} dark:text-gray-100`}
              title={`% Used ${pp.pctUsed.toFixed(1)} · Open ${pp.open} · Exp ≤7d ${pp.soon}`}
            >
              {`${pp.id.slice(0, 4)}… · ${pp.pctUsed.toFixed(0)}% used · ${pp.open} open · ${pp.soon} ≤7d`}
            </motion.span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
