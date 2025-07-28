"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AddTradeModal } from "@/components/add-trade-modal";
import { OpenTradesTable } from "@/components/open-trades-table";
import { ClosedTradesTable } from "@/components/closed-trades-table";
import { Portfolio, Metrics } from "@/types";
import { useTrades } from "@/hooks/useTrades";
import { MetricsCard } from "@/components/metrics-card";
import { getPortfolioMetrics } from "@/lib/getPortfolioMetrics";

export function PortfolioDetail({ portfolio }: { portfolio: Portfolio }) {
  const router = useRouter();
  const { trades: openTrades, isLoading: loadingOpen } = useTrades(
    portfolio.id,
    "open",
  );
  const { trades: closedTrades, isLoading: loadingClosed } = useTrades(
    portfolio.id,
    "closed",
  );

  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      const data = await getPortfolioMetrics(portfolio.id);
      setMetrics(data);
    }
    fetchMetrics();
  }, [portfolio.id]);

  return (
    <div className="max-w-4xl mx-auto py-16 px-6 space-y-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {portfolio.name || "Unnamed Portfolio"}
        </h1>
        <Button variant="default" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      <Card className="bg-white shadow-sm">
        <CardContent className="p-6 space-y-2">
          <p>
            <strong>Starting Capital:</strong> ${" "}
            {portfolio.startingCapital.toLocaleString()}
          </p>
          <p>
            <strong>Current Capital:</strong> ${" "}
            {portfolio.currentCapital.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <ClosedTradesTable trades={closedTrades} />
        )}
      </div>
    </div>
  );
}
