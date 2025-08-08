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

  return (
    <div className="max-w-4xl mx-auto py-16 px-6 space-y-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {portfolio.name || "Unnamed Portfolio"}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white shadow-sm rounded-lg">
          <CardContent className="p-6">
            <p className="text-base font-medium text-gray-600">
              Starting Capital
            </p>
            <p className="text-3xl font-bold text-gray-900">
              ${portfolio.startingCapital.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm rounded-lg">
          <CardContent className="p-6">
            <p className="text-base font-medium text-gray-600">
              Current Capital
            </p>
            <p
              className={`text-3xl font-bold ${
                metrics?.capitalUsed != null &&
                portfolio.startingCapital - metrics.capitalUsed < 0
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              $
              {metrics?.capitalUsed != null
                ? (
                    portfolio.startingCapital - metrics.capitalUsed
                  ).toLocaleString()
                : "Loading..."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricsCard
          label="% Capital Used"
          value={
            metrics?.percentCapitalDeployed != null
              ? `${metrics.percentCapitalDeployed.toFixed(2)}%`
              : "Loading..."
          }
          className={
            metrics?.percentCapitalDeployed != null &&
            metrics.percentCapitalDeployed >= 85
              ? "text-red-600"
              : "text-green-600"
          }
        />
        <MetricsCard
          label="Avg. Days Held"
          value={
            metrics?.avgDaysInTrade != null
              ? `${metrics.avgDaysInTrade.toFixed(2)} days`
              : "-"
          }
        />
        <MetricsCard
          label="Win Rate"
          value={
            metrics?.winRate != null
              ? `${(metrics.winRate * 100).toFixed(2)}%`
              : "Loading..."
          }
          className={
            metrics?.winRate != null && metrics.winRate > 0.5
              ? "text-green-600"
              : "text-red-600"
          }
        />
        <MetricsCard
          label="Total Profit"
          value={
            metrics?.totalProfit != null
              ? `$${metrics.totalProfit.toLocaleString()}`
              : "Loading..."
          }
          className={
            metrics?.totalProfit != null && metrics.totalProfit >= 0
              ? "text-green-600"
              : "text-red-600"
          }
        />
        <MetricsCard
          label="Avg P/L %"
          value={
            metrics?.avgPLPercent != null
              ? `${metrics.avgPLPercent.toFixed(2)}%`
              : "Loading..."
          }
          className={
            metrics?.avgPLPercent != null && metrics.avgPLPercent >= 0
              ? "text-green-600"
              : "text-red-600"
          }
        />
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Open Positions</h2>
        <AddTradeModal portfolioId={portfolio.id} />
      </div>
      <div className="w-full rounded-lg bg-white p-6 text-gray-700 text-sm shadow-sm">
        {loadingOpen ? (
          <p>Loading open trades...</p>
        ) : (
          <OpenTradesTable trades={openTrades} portfolioId={portfolio.id} />
        )}
      </div>

      <h2 className="text-xl font-semibold mt-10">Closed Positions</h2>
      <div className="w-full rounded-lg bg-white p-6 text-gray-700 text-sm shadow-sm">
        {loadingClosed ? (
          <p>Loading closed trades...</p>
        ) : (
          <ClosedTradesTable trades={closedTrades} portfolioId={portfolio.id} />
        )}
      </div>
    </div>
  );
}
