"use client";
import { Card, CardContent } from "@/components/ui/card";
import { AddTradeModal } from "@/features/trades/components/AddTradeModal";
import { OpenTradesTable } from "@/features/trades/components/TradeTables/OpenTradesTable";
// dynamic import for faster initial render
import dynamic from "next/dynamic";
const ClosedTradesTable = dynamic(
  () =>
    import("@/features/trades/components/TradeTables/ClosedTradesTable").then(
      (m) => m.ClosedTradesTable,
    ),
  { ssr: false, loading: () => <p>Loading closed trades…</p> },
);

import { Portfolio } from "@/types";
import { useTrades } from "@/features/trades/hooks/useTrades";
import { MetricsCard } from "@/features/portfolios/components/MetricsCard";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useDetailMetrics } from "@/features/portfolios/hooks/useDetailMetrics";

//Currency formatting utility for Total Profit display
function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

// Simple in-view hook to lazily mount closed trades
function useInViewOnce<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || inView) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [inView]);
  return { ref, inView };
}

export function PortfolioDetail({ portfolio }: { portfolio: Portfolio }) {
  const { trades: openTrades, isLoading: loadingOpen } = useTrades(
    portfolio.id,
    "open",
  );
  const { trades: closedTrades, isLoading: loadingClosed } = useTrades(
    portfolio.id,
    "closed",
  );

  // NEW: detail metrics from API
  const { data: metrics } = useDetailMetrics(portfolio.id);

  // Normalize numeric fields (Decimal/string -> number)
  const starting = Number(portfolio.startingCapital ?? 0);
  const addl = Number(portfolio.additionalCapital ?? 0);

  // Total Capital = Capital Base (starting + additional) + Total Profit
  const totalCapital =
    (metrics?.capitalBase != null
      ? Number(metrics.capitalBase)
      : starting + addl) + (metrics?.totalProfit != null ? Number(metrics.totalProfit) : 0);

  // Defer mounting closed trades until scrolled near
  const { ref: closedSentinelRef, inView: showClosed } = useInViewOnce();

  // Prepare metric items for display (unchanged API shape)
  const metricItems = [
    {
      key: "openPremium",
      order: 1,
      label: "Open Premium",
      value:
        metrics?.potentialPremium != null
          ? formatCompactCurrency(metrics.potentialPremium)
          : "Loading...",
      className: "text-teal-600",
    },
    {
      key: "avgPL",
      order: 2,
      label: "Avg P/L %",
      value:
        metrics?.avgPLPercent != null
          ? `${metrics.avgPLPercent.toFixed(2)}%`
          : "Loading...",
      className:
        metrics?.avgPLPercent != null && metrics.avgPLPercent >= 0
          ? "text-green-600"
          : "text-red-600",
    },
    {
      key: "winRate",
      order: 3,
      label: "Win Rate",
      value:
        metrics?.winRate != null
          ? `${(metrics.winRate * 100).toFixed(2)}%`
          : "Loading...",
      className:
        metrics?.winRate != null && metrics.winRate > 0.5
          ? "text-green-600"
          : "text-red-600",
    },
    {
      key: "avgDays",
      order: 4,
      label: "Avg. Days Held",
      value:
        metrics?.avgDaysInTrade != null
          ? `${metrics.avgDaysInTrade.toFixed(0)}`
          : "Loading...",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-16 px-6 space-y-12">
      <motion.div
        className="flex justify-between items-center"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{ willChange: "opacity, transform" }}
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {portfolio.name || "Unnamed Portfolio"}
        </h1>
      </motion.div>

      {/* Capital & P/L cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.06 }}
          whileHover={{ y: -2 }}
          style={{ willChange: "opacity, transform" }}
        >
          <Card className="bg-white dark:bg-gray-900 dark:border-gray-800 shadow-sm rounded-lg h-full">
            <CardContent className="p-6">
              <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                Capital Available
              </p>
              <p
                className={`text-3xl font-bold dark:text-gray-300 ${
                  metrics?.cashAvailable != null && metrics.cashAvailable < 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {metrics?.cashAvailable != null
                  ? formatCompactCurrency(metrics.cashAvailable)
                  : "Loading..."}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Total Capital: {formatCompactCurrency(totalCapital)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Starting: {formatCompactCurrency(starting)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Additional: {formatCompactCurrency(addl)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Profits: {metrics?.totalProfit != null ? formatCompactCurrency(metrics.totalProfit) : "—"}
              </p>
              <p
                className={`text-sm font-medium ${
                  metrics?.percentCapitalDeployed != null &&
                  metrics.percentCapitalDeployed >= 85
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {metrics?.percentCapitalDeployed != null
                  ? `% Used: ${metrics.percentCapitalDeployed.toFixed(2)}%`
                  : ""}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.1 }}
          whileHover={{ y: -2 }}
          style={{ willChange: "opacity, transform" }}
        >
          <Card className="bg-white dark:bg-gray-900 dark:border-gray-800 shadow-sm rounded-lg h-full">
            <CardContent className="p-6">
              <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                P&L Overview
              </p>
              <p
                className={`text-3xl font-bold dark:text-gray-300 ${
                  metrics?.totalProfit != null && metrics.totalProfit >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {metrics?.totalProfit != null
                  ? formatCompactCurrency(metrics.totalProfit)
                  : "Loading..."}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                MTD:{" "}
                {metrics?.realizedMTD != null
                  ? formatCompactCurrency(metrics.realizedMTD)
                  : "—"}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                YTD:{" "}
                {metrics?.realizedYTD != null
                  ? formatCompactCurrency(metrics.realizedYTD)
                  : "—"}
              </p>
              {metrics?.realizedPrevMonth != null && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Prev Mo:{" "}
                  {formatCompactCurrency(metrics.realizedPrevMonth)}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Secondary metrics */}
      <motion.div
        className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
      >
        {[...metricItems]
          .sort((a, b) => a.order - b.order)
          .map((m, i) => (
            <motion.div
              key={m.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.12 + i * 0.04 }}
              whileHover={{ y: -2 }}
              style={{ willChange: "opacity, transform" }}
            >
              <MetricsCard
                label={m.label}
                value={m.value}
                className={m.className}
              />
            </motion.div>
          ))}
      </motion.div>

      {/* Open positions */}
      <motion.div
        className="flex justify-between items-center"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.18 }}
        style={{ willChange: "opacity, transform" }}
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Open Positions
        </h2>
        <AddTradeModal portfolioId={portfolio.id} />
      </motion.div>
      <motion.div
        className="w-full rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 text-sm shadow-sm"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.22 }}
        style={{ willChange: "opacity, transform" }}
      >
        {loadingOpen ? (
          <p>Loading open trades...</p>
        ) : (
          <OpenTradesTable trades={openTrades} portfolioId={portfolio.id} />
        )}
      </motion.div>

      {/* Closed positions (lazy mount when near viewport) */}
      <div ref={closedSentinelRef} />
      <motion.h2
        className="text-xl font-semibold mt-10 text-gray-900 dark:text-gray-100"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.26 }}
        style={{ willChange: "opacity, transform" }}
      >
        Closed Positions
      </motion.h2>
      <motion.div
        className="w-full rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 text-sm shadow-sm"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.3 }}
        style={{ willChange: "opacity, transform" }}
      >
        {showClosed ? (
          loadingClosed ? (
            <p>Loading closed trades...</p>
          ) : (
            <ClosedTradesTable
              trades={closedTrades}
              portfolioId={portfolio.id}
            />
          )
        ) : (
          <p>Scroll to load closed trades…</p>
        )}
      </motion.div>
    </div>
  );
}
