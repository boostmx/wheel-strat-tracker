"use client";

import { useEffect, useState } from "react";
import { Trade } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  portfolioId: string;
  tradeId: string;
};

export default function TradeDetailPageClient({ portfolioId, tradeId }: Props) {
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

  const formatType = (type: string) =>
    type.replace(/([a-z])([A-Z])/g, "$1 $2");

  const statusBadge = (status: "open" | "closed") => {
    const color =
      status === "open"
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

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
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" asChild className="text-sm">
          <Link href={`/portfolio/${portfolioId}`}>← Back to Portfolio</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">
              {trade.ticker} — {formatType(trade.type)}
            </h1>
            {statusBadge(trade.status)}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p>
                <span className="font-medium text-muted-foreground">Type:</span>{" "}
                {formatType(trade.type)}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Strike:</span>{" "}
                ${trade.strikePrice.toFixed(2)}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Contracts:</span>{" "}
                {trade.contracts}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Avg Price:</span>{" "}
                ${trade.contractPrice.toFixed(2)}
              </p>
            </div>

            <div className="space-y-1">
              <p>
                <span className="font-medium text-muted-foreground">Opened:</span>{" "}
                {new Date(trade.createdAt).toLocaleDateString()}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Expiration:</span>{" "}
                {new Date(trade.expirationDate).toLocaleDateString()}
              </p>
              {trade.status === "closed" && (
                <>
                  <p>
                    <span className="font-medium text-muted-foreground">Closed:</span>{" "}
                    {trade.closedAt
                      ? new Date(trade.closedAt).toLocaleDateString()
                      : "-"}
                  </p>
                  <p>
                    <span className="font-medium text-muted-foreground">% P/L:</span>{" "}
                    {trade.percentPL != null
                      ? `${trade.percentPL.toFixed(2)}%`
                      : "-"}
                  </p>
                  <p>
                    <span className="font-medium text-muted-foreground">Captured:</span>{" "}
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
        </CardContent>
      </Card>
    </div>
  );
}