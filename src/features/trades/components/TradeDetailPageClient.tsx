"use client";
import { useMemo, useState } from "react";
import type React from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { Trade } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradeNotesSimple } from "@/features/trades/components/TradeNotesSimple";
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
  return isCashSecuredPut ? t.strikePrice * 100 * t.contracts : 0;
};

// Simple validators
function isPositiveInt(v: string | number) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isInteger(n) && n > 0;
}

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

  const [addOpen, setAddOpen] = useState(false);
  const [addedContracts, setAddedContracts] = useState("");
  const [addedContractPrice, setAddedContractPrice] = useState({
    formatted: "",
    raw: 0,
  });
  const [addedContractsTouched, setAddedContractsTouched] = useState(false);
  const [addedPriceTouched, setAddedPriceTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [closeOpen, setCloseOpen] = useState(false);
  const [closingContracts, setClosingContracts] = useState("");
  const [closingContractPrice, setClosingContractPrice] = useState({
    formatted: "",
    raw: 0,
  });
  const [closingContractsTouched, setClosingContractsTouched] = useState(false);
  const [closingPriceTouched, setClosingPriceTouched] = useState(false);

  // "Close full position" checkbox state
  const [closeAll, setCloseAll] = useState(false);

  const [closing, setClosing] = useState(false);

  // Validation helpers for modals
  const maxClosable = trade?.contracts ?? 0;

  // When closing full position, auto-fill contracts and lock input
  const effectiveClosingContracts = closeAll
    ? String(maxClosable)
    : closingContracts;

  // Validity booleans (independent of touched state for button enabling)
  const contractsCloseValid =
    isPositiveInt(effectiveClosingContracts) &&
    Number(effectiveClosingContracts) <= maxClosable;
  const priceCloseValid = Number(closingContractPrice?.raw ?? 0) > 0;
  const canClose =
    trade?.status === "open" && contractsCloseValid && priceCloseValid;

  const contractsAddValid = isPositiveInt(addedContracts);
  const priceAddValid = Number(addedContractPrice?.raw ?? 0) > 0;
  const canAdd = trade?.status === "open" && contractsAddValid && priceAddValid;

  // Error text (shown only if touched)
  const closeContractsErr = !contractsCloseValid
    ? !isPositiveInt(effectiveClosingContracts)
      ? "Enter a valid whole number of contracts."
      : Number(effectiveClosingContracts) > maxClosable
        ? `Cannot close more than ${maxClosable} contracts.`
        : ""
    : "";

  const closePriceErr = !priceCloseValid ? "Enter a valid closing price." : "";

  const addContractsErr = !contractsAddValid
    ? "Enter a valid whole number of contracts."
    : "";
  const addPriceErr = !priceAddValid ? "Enter a valid price per contract." : "";

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

  const submitCloseTrade = async () => {
    if (!canClose) {
      // Respect touched UX: show an error only after marking both inputs touched
      setClosingContractsTouched(true);
      setClosingPriceTouched(true);
      toast.error(
        closeContractsErr || closePriceErr || "Fix errors before submitting.",
      );
      return;
    }
    const contractsNum = Number(effectiveClosingContracts);
    const priceNum = Number(closingContractPrice?.raw ?? Number.NaN);

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
      // Refresh this trade
      await mutate();
      // Also refresh related portfolio metrics (detail + overview)
      void globalMutate(`/api/portfolios/${portfolioId}/detail-metrics`);
      void globalMutate(`/api/portfolios/${portfolioId}/metrics`);

      toast.success("Position closed.");
      setCloseOpen(false);
      setClosingContracts("");
      setClosingContractPrice({ formatted: "", raw: 0 });
      setClosingContractsTouched(false);
      setClosingPriceTouched(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to close trade.");
    } finally {
      setClosing(false);
    }
  };

  const submitAddToTrade = async () => {
    if (!canAdd) {
      setAddedContractsTouched(true);
      setAddedPriceTouched(true);
      toast.error(
        addContractsErr || addPriceErr || "Fix errors before submitting.",
      );
      return;
    }
    const contractsNum = Number(addedContracts);
    const priceNum = Number(addedContractPrice?.raw ?? Number.NaN);

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
      // Refresh this trade
      await mutate();
      // Also refresh related portfolio metrics (detail + overview)
      void globalMutate(`/api/portfolios/${portfolioId}/detail-metrics`);
      void globalMutate(`/api/portfolios/${portfolioId}/metrics`);

      toast.success("Position updated.");
      setAddOpen(false);
      setAddedContracts("");
      setAddedContractPrice({ formatted: "", raw: 0 });
      setAddedContractsTouched(false);
      setAddedPriceTouched(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update trade.");
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleClosePriceKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") submitCloseTrade();
  };
  const handleAddPriceKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") submitAddToTrade();
  };

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
          <Link href={`/portfolio/${portfolioId}`}>← Back to Portfolio</Link>
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
                  {trade.contracts}
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
                <Dialog
                  open={closeOpen}
                  onOpenChange={(o) => {
                    setCloseOpen(o);
                    if (!o) {
                      // reset touched on close
                      setClosingContractsTouched(false);
                      setClosingPriceTouched(false);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline">Close Position</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Close Position</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-3 items-start">
                      <div className="sm:col-span-1">
                        <label className="text-sm block mb-1">Contracts</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          autoFocus
                          disabled={closeAll}
                          aria-invalid={
                            closingContractsTouched && !contractsCloseValid
                          }
                          aria-describedby="close-contracts-help"
                          value={effectiveClosingContracts}
                          onBlur={() => setClosingContractsTouched(true)}
                          onChange={(e) => {
                            setClosingContractsTouched(true);
                            setClosingContracts(
                              e.target.value.replace(/\D/g, ""),
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitCloseTrade();
                          }}
                          placeholder={`e.g., ${trade.contracts}`}
                          className="h-11 text-base"
                        />
                        <p
                          id="close-contracts-help"
                          className={`text-xs mt-1 h-6 ${closingContractsTouched && !contractsCloseValid ? "text-red-600" : "text-muted-foreground"}`}
                        >
                          {closingContractsTouched && !contractsCloseValid
                            ? closeContractsErr
                            : closeAll
                              ? "Closing all contracts"
                              : `Max: ${maxClosable}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            id="close-all"
                            type="checkbox"
                            className="h-4 w-4"
                            checked={closeAll}
                            onChange={(e) => {
                              const next = e.target.checked;
                              setCloseAll(next);
                              if (next) {
                                setClosingContracts(String(maxClosable));
                                setClosingContractsTouched(true);
                              }
                            }}
                          />
                          <label
                            htmlFor="close-all"
                            className="text-xs text-muted-foreground select-none"
                          >
                            Close full position
                          </label>
                        </div>
                      </div>
                      <div className="sm:col-span-1">
                        <label className="text-sm block mb-1">
                          Closing Price
                        </label>
                        <div onKeyDown={handleClosePriceKeyDown}>
                          <CurrencyInput
                            value={closingContractPrice}
                            onChange={(v) => {
                              setClosingPriceTouched(true);
                              setClosingContractPrice(v);
                            }}
                            placeholder="e.g., 0.20"
                          />
                        </div>
                        <p
                          className={`text-xs mt-1 h-6 ${closingPriceTouched && !priceCloseValid ? "text-red-600" : "text-muted-foreground"}`}
                        >
                          {closingPriceTouched && !priceCloseValid
                            ? closePriceErr
                            : "Enter per‑contract price"}
                        </p>
                      </div>
                      <div className="sm:col-span-1 flex items-start pt-6">
                        <Button
                          onClick={submitCloseTrade}
                          disabled={closing || !canClose}
                          className="w-full"
                        >
                          {closing ? "Closing…" : "Submit"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Add to Position Button/Modal (right) */}
                <Dialog
                  open={addOpen}
                  onOpenChange={(o) => {
                    setAddOpen(o);
                    if (!o) {
                      // reset touched on close
                      setAddedContractsTouched(false);
                      setAddedPriceTouched(false);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>Add to Position</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add to Position</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-3 items-start">
                      <div className="sm:col-span-1">
                        <label className="text-sm block mb-1">
                          Contracts to Add
                        </label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          autoFocus
                          aria-invalid={
                            addedContractsTouched && !contractsAddValid
                          }
                          aria-describedby="add-contracts-help"
                          value={addedContracts}
                          onBlur={() => setAddedContractsTouched(true)}
                          onChange={(e) => {
                            setAddedContractsTouched(true);
                            setAddedContracts(
                              e.target.value.replace(/\D/g, ""),
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitAddToTrade();
                          }}
                          placeholder="e.g., 2"
                          className="h-11 text-base"
                        />
                        <p
                          id="add-contracts-help"
                          className={`text-xs mt-1 h-6 ${addedContractsTouched && !contractsAddValid ? "text-red-600" : "text-muted-foreground"}`}
                        >
                          {addedContractsTouched && !contractsAddValid
                            ? addContractsErr
                            : "Whole numbers only"}
                        </p>
                      </div>
                      <div className="sm:col-span-1">
                        <label className="text-sm block mb-1">
                          Price per Contract
                        </label>
                        <div onKeyDown={handleAddPriceKeyDown}>
                          <CurrencyInput
                            value={addedContractPrice}
                            onChange={(v) => {
                              setAddedPriceTouched(true);
                              setAddedContractPrice(v);
                            }}
                            placeholder="e.g., 0.85"
                          />
                        </div>
                        <p
                          className={`text-xs mt-1 h-6 ${addedPriceTouched && !priceAddValid ? "text-red-600" : "text-muted-foreground"}`}
                        >
                          {addedPriceTouched && !priceAddValid
                            ? addPriceErr
                            : "Enter per‑contract price"}
                        </p>
                      </div>
                      <div className="sm:col-span-1 flex items-start pt-6">
                        <Button
                          onClick={submitAddToTrade}
                          disabled={submitting || !canAdd}
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
      </motion.div>
    </div>
  );
}
