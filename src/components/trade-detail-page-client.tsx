"use client";
import { useEffect, useState } from "react";
import { Trade } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { formatDateOnlyUTC, ensureUtcMidnight } from "@/lib/formatDateOnly";

type Props = {
  portfolioId: string;
  tradeId: string;
};

//Currency formatting for all money values
const formatUSD = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export default function TradeDetailPageClient({ portfolioId, tradeId }: Props) {
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addedContracts, setAddedContracts] = useState("");
  const [addedContractPrice, setAddedContractPrice] = useState({
    formatted: "",
    raw: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closingContracts, setClosingContracts] = useState("");
  const [closingContractPrice, setClosingContractPrice] = useState({
    formatted: "",
    raw: 0,
  });
  const [closing, setClosing] = useState(false);

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

  const formatType = (type: string) => type.replace(/([a-z])([A-Z])/g, "$1 $2");

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

  const refetchTrade = async () => {
    try {
      const res = await fetch(`/api/trades/${tradeId}`);
      if (!res.ok) throw new Error("Failed to fetch trade");
      const data = await res.json();
      setTrade(data);
    } catch {
      toast.error("Failed to refresh trade after update.");
    }
  };

  const submitCloseTrade = async () => {
    const contractsNum = Number(closingContracts);
    const priceNum = Number(closingContractPrice?.raw ?? Number.NaN);

    if (!Number.isFinite(contractsNum) || contractsNum <= 0) {
      toast.error("Enter a valid number of contracts to close.");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("Enter a valid closing price per contract.");
      return;
    }

    setClosing(true);
    try {
      const res = await fetch(`/api/trades/${tradeId}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingContracts: contractsNum,
          closingContractPrice: priceNum,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Unable to close trade");
      }
      await refetchTrade();
      toast.success("Position closed.");
      setCloseOpen(false);
      setClosingContracts("");
      setClosingContractPrice({ formatted: "", raw: 0 });
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast.error(e.message);
      } else {
        toast.error("Failed to close trade.");
      }
    } finally {
      setClosing(false);
    }
  };

  const submitAddToTrade = async () => {
    const contractsNum = Number(addedContracts);
    const priceNum = Number(addedContractPrice?.raw ?? Number.NaN);

    if (!Number.isFinite(contractsNum) || contractsNum <= 0) {
      toast.error("Enter a valid number of contracts.");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("Enter a valid price per contract.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/trades/${tradeId}/add`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addedContracts: contractsNum,
          addedContractPrice: priceNum,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Unable to add to trade");
      }
      await refetchTrade();
      toast.success("Position updated.");
      setAddOpen(false);
      setAddedContracts("");
      setAddedContractPrice({ formatted: "", raw: 0 });
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast.error(e.message);
      } else {
        toast.error("Failed to update trade.");
      }
    } finally {
      setSubmitting(false);
    }
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
    <div className="max-w-3xl mx-auto py-10 space-y-6 relative">
      <div className="flex justify-end mb-4">
        <Button variant="outline" asChild className="text-sm">
          <Link href={`/portfolio/${portfolioId}`}>← Back to Portfolio</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6 relative">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">
              {trade.ticker} — {formatType(trade.type)}
            </h1>
            <div className="flex items-center gap-3">
              {statusBadge(trade.status)}
              {/* Edit Button Placeholder */}
              {trade.status === "open" && (
                <Button variant="outline" disabled>
                  Edit
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p>
                <span className="font-medium text-muted-foreground">Type:</span>{" "}
                {formatType(trade.type)}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">
                  Strike:
                </span>{" "}
                {formatUSD(trade.strikePrice)}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">
                  Stock Entry Price:
                </span>{" "}
                {trade.entryPrice != null ? formatUSD(trade.entryPrice) : "-"}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">
                  Contracts:
                </span>{" "}
                {trade.contracts}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">
                  Avg Price:
                </span>{" "}
                {formatUSD(trade.contractPrice)}
              </p>
            </div>

            <div className="space-y-1">
              <p>
                <span className="font-medium text-muted-foreground">
                  Opened:
                </span>{" "}
                {formatDateOnlyUTC(trade.createdAt)}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">
                  Expiration:
                </span>{" "}
                {formatDateOnlyUTC(trade.expirationDate)}
              </p>

              {trade.status === "open" && (
                <p>
                  <span className="font-medium text-muted-foreground">
                    Days Until Expiration:
                  </span>{" "}
                  {(() => {
                    const msPerDay = 86_400_000;
                    const exp = ensureUtcMidnight(trade.expirationDate).getTime();
                    const today = ensureUtcMidnight(new Date()).getTime();
                    return Math.max(0, Math.ceil((exp - today) / msPerDay));
                  })()}
                </p>
              )}

              {trade.status === "closed" && (
                <>
                  <p>
                    <span className="font-medium text-muted-foreground">
                      Closed:
                    </span>{" "}
                    {trade.closedAt ? formatDateOnlyUTC(trade.closedAt) : "-"}
                  </p>
                  <p>
                    <span className="font-medium text-muted-foreground">
                      Days Held:
                    </span>{" "}
                    {trade.closedAt
                      ? (() => {
                          const msPerDay = 86_400_000;
                          const closed = ensureUtcMidnight(trade.closedAt).getTime();
                          const opened = ensureUtcMidnight(trade.createdAt).getTime();
                          return Math.max(0, Math.ceil((closed - opened) / msPerDay));
                        })()
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
                      Premium Captured:
                    </span>{" "}
                    {trade.premiumCaptured != null
                      ? formatUSD(trade.premiumCaptured)
                      : "-"}
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

          {/* Add to/Close Position buttons at bottom right of card */}
          {trade.status === "open" && (
            <div className="absolute right-6 bottom-6 flex items-end gap-2">
              {/* Close Position Button/Modal (left) */}
              <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Close Position</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Close Position</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 sm:grid-cols-3 items-end">
                    <div className="sm:col-span-1">
                      <label className="text-sm block mb-1">Contracts</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={closingContracts}
                        onChange={(e) =>
                          setClosingContracts(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder={`e.g., ${trade.contracts}`}
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-sm block mb-1">
                        Closing Price
                      </label>
                      <CurrencyInput
                        value={closingContractPrice}
                        onChange={setClosingContractPrice}
                        placeholder="e.g., 0.20"
                      />
                    </div>
                    <div className="sm:col-span-1 flex items-end">
                      <Button
                        onClick={submitCloseTrade}
                        disabled={closing}
                        className="w-full"
                      >
                        {closing ? "Closing…" : "Submit"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Add to Position Button/Modal (right) */}
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button>Add to Position</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add to Position</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <label className="text-sm block mb-1">
                        Contracts to Add
                      </label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={addedContracts}
                        onChange={(e) =>
                          setAddedContracts(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="e.g., 2"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-sm block mb-1">
                        Price per Contract
                      </label>
                      <CurrencyInput
                        value={addedContractPrice}
                        onChange={setAddedContractPrice}
                        placeholder="e.g., 0.85"
                      />
                    </div>
                    <div className="sm:col-span-1 flex items-end">
                      <Button
                        onClick={submitAddToTrade}
                        disabled={submitting}
                        className="w-full"
                      >
                        {submitting ? "Updating…" : "Submit"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
