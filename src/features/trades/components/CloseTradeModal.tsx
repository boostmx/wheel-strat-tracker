"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Trade } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/ui/currency-input";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { mutate } from "swr";

interface CloseTradeModalProps {
  id: string;
  portfolioId: string;
  isOpen: boolean;
  onClose: () => void;
  strikePrice: number;
  contracts: number;
  ticker?: string;
  expirationDate?: string;
  type?: string;
  refresh?: () => void; // optional legacy fallback
}

// simple int validator
function isPositiveInt(v: string | number) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isInteger(n) && n > 0;
}

export function CloseTradeModal({
  id,
  portfolioId,
  isOpen,
  onClose,
  strikePrice,
  contracts,
  ticker,
  expirationDate,
  type,
  refresh,
}: CloseTradeModalProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [fullClose, setFullClose] = useState(true);
  const [contractsToClose, setContractsToClose] = useState(contracts);
  const [closingPrice, setClosingPrice] = useState({ formatted: "", raw: 0 });

  // touched flags (show errors only after interaction)
  const [contractsTouched, setContractsTouched] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFullClose(true);
      setContractsToClose(contracts);
      setClosingPrice({ formatted: "", raw: 0 });
      setSubmitting(false);
      setContractsTouched(false);
      setPriceTouched(false);
    }
  }, [isOpen, contracts]);

  // Fetch trade for fallback display fields when props are missing
  const { data: tradeData } = useSWR<Trade>(
    isOpen ? `/api/trades/${id}` : null,
    (url: string) => fetch(url).then(r => r.json()),
    { dedupingInterval: 10_000 }
  );

  // Prefer props; fall back to fetched trade data
  const displayTicker = ticker ?? tradeData?.ticker ?? "";

  const humanize = (s?: string) =>
    (s ?? "")
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .trim();

  const displayType = humanize(type ?? tradeData?.type ?? "");

  const displayAvgPrice = tradeData?.contractPrice; // average price per contract (fallback)
  const displayExpiration = expirationDate ?? (tradeData?.expirationDate ? String(tradeData.expirationDate) : undefined);

  // Effective contracts (honor full close)
  const effectiveContracts = fullClose ? contracts : contractsToClose;

  // Validations
  const contractsValid =
    isPositiveInt(effectiveContracts) && Number(effectiveContracts) <= contracts;
  const priceValid = Number(closingPrice.raw) > 0;
  const canSubmit = contractsValid && priceValid;

  const contractsErr = !contractsValid
    ? !isPositiveInt(effectiveContracts)
      ? "Enter a valid whole number of contracts."
      : Number(effectiveContracts) > contracts
      ? `Cannot close more than ${contracts} contracts.`
      : ""
    : "";

  const priceErr = !priceValid ? "Enter a valid closing price." : "";

  const handleSubmit = async () => {
    if (!canSubmit) {
      // surface errors if user hasn't interacted
      setContractsTouched(true);
      setPriceTouched(true);
      toast.error(contractsErr || priceErr || "Fix errors before submitting.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`/api/trades/${id}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingContracts: Number(effectiveContracts),
          closingContractPrice: Number(closingPrice.raw),
          fullClose,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Error closing trade");
      }

      // Revalidate all dependent data (detail metrics + lists)
      await Promise.allSettled([
        mutate(`/api/portfolios/${portfolioId}/detail-metrics`),
        mutate(`/api/trades?portfolioId=${portfolioId}&status=open`),
        mutate(`/api/trades?portfolioId=${portfolioId}&status=closed`),
        // If you also use an overview metrics endpoint, add it here:
        mutate(`/api/portfolios/${portfolioId}/metrics`),
      ]);

      // Force-refresh any server-rendered cards
      router.refresh();

      toast.success("Position closed successfully!");
      onClose();

      // Optional: legacy refresh callback (safe no-op if not provided)
      refresh?.();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Error closing trade";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {`Close Position${displayTicker ? ` — ${displayTicker}` : ""}`}
          </DialogTitle>
        </DialogHeader>

        {/* Trade summary */}
        <div className="bg-muted rounded-md px-3 py-2 text-sm mb-3 space-y-0.5">
          <p>
            <span className="font-medium">Type:</span> {displayType}
          </p>
          <p>
            <span className="font-medium">Strike:</span> ${strikePrice.toFixed(2)}
          </p>
          {typeof displayAvgPrice === "number" && (
            <p>
              <span className="font-medium">Avg Price:</span> ${displayAvgPrice.toFixed(2)}
            </p>
          )}
          {displayExpiration && (
            <p>
              <span className="font-medium">Expiration:</span>{" "}
              {format(new Date(displayExpiration), "MMM d, yyyy")}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:[grid-template-columns:1fr_1fr auto] items-start">
          {/* Contracts column */}
          <div className="sm:col-span-1">
            <Label htmlFor="contractsToClose" className="text-sm whitespace-nowrap">Contracts</Label>

            <Input
              id="contractsToClose"
              type="text"
              inputMode="numeric"
              className="h-11 text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              disabled={!!fullClose}
              aria-invalid={contractsTouched && !contractsValid}
              aria-describedby="contracts-help"
              value={fullClose ? String(contracts) : contractsToClose === 0 ? "" : String(contractsToClose)}
              onBlur={() => setContractsTouched(true)}
              onChange={(e) => {
                setContractsTouched(true);
                const val = e.target.value;
                if (/^(0|[1-9][0-9]*)?$/.test(val)) {
                  const num = val === "" ? 0 : Number(val);
                  if (num <= contracts) setContractsToClose(num);
                }
              }}
              placeholder={`Max ${contracts}`}
              required
            />

            {/* fixed-height helper row to prevent layout shift */}
            <p
              id="contracts-help"
              className={`text-xs mt-1 h-6 ${
                contractsTouched && !contractsValid
                  ? "text-red-600"
                  : "text-muted-foreground"
              }`}
            >
              {contractsTouched && !contractsValid
                ? contractsErr
                : fullClose
                ? "Closing all contracts"
                : `Max: ${contracts}`}
            </p>
          </div>

          {/* Price column */}
          <div className="sm:col-span-1">
            <Label className="text-sm whitespace-nowrap">Close Price</Label>
            {/* CurrencyInput doesn't expose onBlur/onKeyDown, wrap to capture Enter */}
            <div
              onKeyDown={(
                e: React.KeyboardEvent<HTMLDivElement>
              ) => {
                if (e.key === "Enter") handleSubmit();
              }}
            >
              <CurrencyInput
                value={closingPrice}
                onChange={(v) => {
                  setPriceTouched(true);
                  setClosingPrice(v);
                }}
                placeholder="e.g., 0.20" 
              />
            </div>

            <p
              className={`text-xs mt-1 h-6 ${
                priceTouched && !priceValid
                  ? "text-red-600"
                  : "text-muted-foreground"
              }`}
            >
              {priceTouched && !priceValid
                ? priceErr
                : "Enter per‑contract price"}
            </p>
          </div>

          {/* Submit column */}
          <div className="sm:col-span-1 flex items-start pt-4">
            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={submitting || !canSubmit}
            >
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>

        <div className="mt-1">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={fullClose}
              onCheckedChange={(v) => {
                const isChecked = !!v;
                setFullClose(isChecked);
                setContractsTouched(true);
                if (isChecked) setContractsToClose(contracts);
              }}
            />
            <span className="text-xs text-muted-foreground">Close full position</span>
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CloseTradeModal;