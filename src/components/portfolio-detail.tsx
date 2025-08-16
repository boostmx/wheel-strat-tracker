"use client";

//import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { AddTradeModal } from "@/components/add-trade-modal";
import { OpenTradesTable } from "@/components/trade-tables/open-trades-table";
import { ClosedTradesTable } from "@/components/trade-tables/closed-trades-table";
import { Portfolio } from "@/types";
import { useTrades } from "@/hooks/useTrades";
import { MetricsCard } from "@/components/metrics-card";
import { getPortfolioMetrics } from "@/lib/getPortfolioMetrics";
import { motion } from "framer-motion";

//Currency formatting utility for Total Profit display
function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function PortfolioDetail({ portfolio }: { portfolio: Portfolio }) {
  //const router = useRouter();
  const { trades: openTrades, isLoading: loadingOpen } = useTrades(
    portfolio.id,
    "open",
  );
  const { trades: closedTrades, isLoading: loadingClosed } = useTrades(
    portfolio.id,
    "closed",
  );

  const { data: metrics } = useSWR(["portfolioMetrics", portfolio.id], () =>
    getPortfolioMetrics(portfolio.id),
  );

  // Normalize numeric fields (Decimal/string -> number)
  const starting = Number(portfolio.startingCapital ?? 0);
  const addl = Number(portfolio.additionalCapital ?? 0);

  // Prepare metric items for display
  // Note: This assumes metrics object has the necessary fields
  // Order them by the 'order' property
  const metricItems = [
    {
      key: "avgDays",
      order: 4,
      label: "Avg. Days Held",
      value:
        metrics?.avgDaysInTrade != null
          ? `${metrics.avgDaysInTrade.toFixed(0).toLocaleString()}`
          : "-",
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
                Current Capital
              </p>
              <p
                className={`text-3xl font-bold dark:text-gray-300 ${
                  metrics?.capitalUsed != null &&
                  metrics?.totalProfit != null &&
                  starting + addl + Number(metrics.totalProfit) - Number(metrics.capitalUsed) < 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {metrics?.capitalUsed != null && metrics?.totalProfit != null
                  ? formatCompactCurrency(
                      starting +
                        addl +
                        Number(metrics.totalProfit) -
                        Number(metrics.capitalUsed),
                    )
                  : "Loading..."}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Starting: {formatCompactCurrency(starting)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Additional: {formatCompactCurrency(addl)}
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
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div
        className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
      >
        {metricItems
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
        {loadingClosed ? (
          <p>Loading closed trades...</p>
        ) : (
          <ClosedTradesTable trades={closedTrades} portfolioId={portfolio.id} />
        )}
      </motion.div>
    </div>
  );
}
