"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Trade } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradeNotesSimple } from "@/features/trades/components/TradeNotesSimple";
import CloseTradeModal from "@/features/trades/components/CloseTradeModal";
import AddToTradeModal from "@/features/trades/components/AddToTradeModal";
import { formatDateOnlyUTC, ensureUtcMidnight } from "@/lib/formatDateOnly";
import { motion } from "framer-motion";

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

const calcCapitalInUse = (t: Trade) => {
  if (!t) return 0;
  if (t.status !== "open") return 0;
  const type = (t.type || "").toLowerCase();
  // Capital in use only applies to cash-secured puts (strike * 100 * contracts)
  const isCashSecuredPut = type.includes("put") && !type.includes("covered");
  return isCashSecuredPut
    ? t.strikePrice * 100 * (t.contractsOpen ?? t.contracts ?? 0)
    : 0;
};

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok)
      throw new Error(
        (await r.json().catch(() => ({}))).error || `Failed ${r.status}`,
      );
    return r.json();
  });

export default function TradeDetailPageClient({ portfolioId, tradeId }: Props) {
  const {
    data: trade,
    isLoading,
    mutate,
  } = useSWR<Trade>(`/api/trades/${tradeId}`, fetcher, {
    dedupingInterval: 10_000,
  });

  // State for shared close modal and add modal
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

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

  // Derived values (memoized so they don't re-run on every small state change)
  const capitalInUse = useMemo(
    () => (trade ? calcCapitalInUse(trade) : 0),
    [trade],
  );

  const daysUntilExpiration = useMemo(() => {
    if (!trade || trade.status !== "open") return null;
    const msPerDay = 86_400_000;
    const exp = ensureUtcMidnight(trade.expirationDate).getTime();
    const today = ensureUtcMidnight(new Date()).getTime();
    return Math.max(0, Math.ceil((exp - today) / msPerDay));
  }, [trade]);

  const daysHeld = useMemo(() => {
    if (!trade || trade.status !== "closed" || !trade.closedAt) return null;
    const msPerDay = 86_400_000;
    const closed = ensureUtcMidnight(trade.closedAt).getTime();
    const opened = ensureUtcMidnight(trade.createdAt).getTime();
    return Math.max(0, Math.ceil((closed - opened) / msPerDay));
  }, [trade]);

  if (isLoading) {
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
    <div className="max-w-3xl mx-auto py-10 space-y-6 relative bg-transparent">
      {/* Back link row */}
      <motion.div
        className="flex justify-end mb-4"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        style={{ willChange: "opacity, transform" }}
      >
        <Button variant="outline" asChild className="text-sm">
          <Link href={`/portfolios/${portfolioId}`}>← Back to Portfolio</Link>
        </Button>
      </motion.div>

      {/* Main card */}
      <motion.div
        className="transform-gpu"
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, delay: 0.04 }}
        style={{ willChange: "opacity" }}
      >
        <Card className="bg-white dark:bg-gray-900 dark:border-gray-800">
          <CardContent className="p-6 space-y-6 relative">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {trade.ticker} — {formatType(trade.type)}
              </h1>
              <div className="flex items-center gap-3">
                {statusBadge(trade.status)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <motion.div
                className="space-y-1"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: 0.06 }}
                style={{ willChange: "opacity, transform" }}
              >
                <p>
                  <span className="font-medium text-muted-foreground">
                    Type:
                  </span>{" "}
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
                  {trade.status === "open"
                    ? (trade.contractsOpen ?? trade.contracts ?? 0)
                    : (trade.contractsInitial ?? trade.contracts ?? 0)}
                </p>
                <p>
                  <span className="font-medium text-muted-foreground">
                    Avg Price:
                  </span>{" "}
                  {formatUSD(trade.contractPrice)}
                </p>
              </motion.div>

              <motion.div
                className="space-y-1"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: 0.1 }}
                style={{ willChange: "opacity, transform" }}
              >
                <p>
                  <span className="font-medium text-muted-foreground">
                    Capital In Use:
                  </span>{" "}
                  {trade.status === "open" ? formatUSD(capitalInUse) : "-"}
                </p>
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
                    {daysUntilExpiration ?? "-"}
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
                      {daysHeld ?? "-"}
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
              </motion.div>
            </div>

            <TradeNotesSimple
              tradeId={tradeId}
              initialNotes={trade.notes ?? ""}
              className="mt-2"
            />

            {/* Add to/Close Position buttons below notes */}
            {trade.status === "open" && (
              <div className="flex justify-end gap-2 pt-2">
                {/* Close Position Button/Modal (left) */}
                <Button
                  variant="outline"
                  onClick={() => setCloseModalOpen(true)}
                >
                  Close Position
                </Button>
                <CloseTradeModal
                  id={trade.id}
                  portfolioId={portfolioId}
                  isOpen={closeModalOpen}
                  onClose={() => setCloseModalOpen(false)}
                  strikePrice={trade.strikePrice}
                  contracts={trade.contractsOpen ?? trade.contracts ?? 0}
                  ticker={trade.ticker}
                  expirationDate={String(trade.expirationDate)}
                  type={trade.type}
                  refresh={() => mutate()} // revalidate this page's trade fetch
                />

                <Button onClick={() => setAddModalOpen(true)}>
                  Add to Position
                </Button>
                <AddToTradeModal
                  isOpen={addModalOpen}
                  onClose={() => setAddModalOpen(false)}
                  tradeId={trade.id}
                  portfolioId={portfolioId}
                  currentContracts={trade.contractsOpen ?? trade.contracts ?? 0}
                  avgContractPrice={trade.contractPrice}
                  ticker={trade.ticker}
                  onUpdated={() => mutate()}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
