"use client";

import { useEffect, useState } from "react";
import { Trade } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Props = {
  portfolioId: string;
  tradeId: string;
};

export default function TradeDetailPageClient({ portfolioId: _porfolioId, tradeId }: Props) {
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrade = async () => {
      try {
        const res = await fetch(`/api/trades/${tradeId}`);
        if (!res.ok) throw new Error("Failed to fetch trade");
        const data = await res.json();
        setTrade(data);
      } catch (err) {
        toast.error("Could not load trade details.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrade();
  }, [tradeId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!trade) {
    return <p className="text-red-500">Trade not found.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{trade.ticker} — Trade Detail</h1>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p>
            <span className="font-medium text-muted-foreground">Type:</span>{" "}
            {trade.type}
          </p>
          <p>
            <span className="font-medium text-muted-foreground">Strike:</span>{" "}
            ${trade.strikePrice.toFixed(2)}
          </p>
          <p>
            <span className="font-medium text-muted-foreground">
              Contracts:
            </span>{" "}
            {trade.totalContracts}
          </p>
          <p>
            <span className="font-medium text-muted-foreground">
              Avg Price:
            </span>{" "}
            ${trade.contractPrice.toFixed(2)}
          </p>
        </div>
        <div>
          <p>
            <span className="font-medium text-muted-foreground">Status:</span>{" "}
            {trade.status}
          </p>
          <p>
            <span className="font-medium text-muted-foreground">Opened:</span>{" "}
            {new Date(trade.createdAt).toLocaleDateString()}
          </p>
          {trade.status === "closed" && (
            <>
              <p>
                <span className="font-medium text-muted-foreground">
                  Closed:
                </span>{" "}
                {trade.closedAt
                  ? new Date(trade.closedAt).toLocaleDateString()
                  : "-"}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">
                  % P/L:
                </span>{" "}
                {trade.percentPL != null
                  ? `${trade.percentPL.toFixed(2)}%`
                  : "-"}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">
                  Captured:
                </span>{" "}
                ${trade.premiumCaptured?.toFixed(2) ?? "-"}
              </p>
            </>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-base text-gray-900">Notes</h3>
        <p className="text-sm whitespace-pre-line text-muted-foreground">
          {trade.notes || "No notes added."}
        </p>
      </div>
    </div>
  );
}