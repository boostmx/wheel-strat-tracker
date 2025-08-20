"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "sonner";
import { mutate } from "swr";

export type AddToTradeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tradeId: string;
  portfolioId: string;
  currentContracts: number;
  avgContractPrice?: number;
  ticker?: string;
  onUpdated?: () => void; // optional: parent can revalidate its own SWR key
};

// simple int validator
function isPositiveInt(v: string | number) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isInteger(n) && n > 0;
}

export default function AddToTradeModal({
  isOpen,
  onClose,
  tradeId,
  portfolioId,
  currentContracts,
  avgContractPrice,
  ticker,
  onUpdated,
}: AddToTradeModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const [contracts, setContracts] = useState<string>("");
  const [price, setPrice] = useState<{ formatted: string; raw: number }>({
    formatted: "",
    raw: 0,
  });

  // touched flags: only show validation after user interacts
  const [contractsTouched, setContractsTouched] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSubmitting(false);
      setContracts("");
      setPrice({ formatted: "", raw: 0 });
      setContractsTouched(false);
      setPriceTouched(false);
    }
  }, [isOpen]);

  const contractsValid = isPositiveInt(contracts);
  const priceValid = Number(price.raw) > 0;
  const canSubmit = contractsValid && priceValid;

  const contractsErr = !contractsValid
    ? "Enter a valid whole number of contracts."
    : "";
  const priceErr = !priceValid ? "Enter a valid price per contract." : "";

  const handleSubmit = async () => {
    if (!canSubmit) {
      setContractsTouched(true);
      setPriceTouched(true);
      toast.error(contractsErr || priceErr || "Fix errors before submitting.");
      return;
    }

    const addedContracts = Number(contracts);
    const addedContractPrice = Number(price.raw);

    try {
      setSubmitting(true);
      const res = await fetch(`/api/trades/${tradeId}/add`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addedContracts, addedContractPrice }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Unable to add to trade");
      }

      // Revalidate keys used around the app
      await Promise.allSettled([
        mutate(`/api/trades/${tradeId}`),
        mutate(`/api/portfolios/${portfolioId}/detail-metrics`),
        mutate(`/api/portfolios/${portfolioId}/metrics`),
        mutate(`/api/trades?portfolioId=${portfolioId}&status=open`),
      ]);

      onUpdated?.();
      toast.success("Position updated.");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update trade.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Add to Position{ticker ? ` — ${ticker}` : ""}
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="bg-muted rounded-md px-3 py-2 text-sm mb-3 space-y-0.5">
          <p className="flex justify-between">
            <span>Current Contracts:</span>
            <span className="font-medium">{currentContracts}</span>
          </p>
          {typeof avgContractPrice === "number" && (
            <p className="flex justify-between">
              <span>Avg Price:</span>
              <span className="font-medium">
                ${avgContractPrice.toFixed(2)}
              </span>
            </p>
          )}
        </div>

        {/* Inputs row */}
        <div className="flex flex-col">
          {/* Contracts */}
          <div className="mt-4">
            <Label
              htmlFor="add-contracts"
              className="text-sm whitespace-nowrap"
            >
              Contracts
            </Label>
            <Input
              id="add-contracts"
              type="text"
              inputMode="numeric"
              className="h-11 text-base"
              aria-invalid={contractsTouched && !contractsValid}
              aria-describedby="add-contracts-help"
              value={contracts}
              onBlur={() => setContractsTouched(true)}
              onChange={(e) => {
                setContractsTouched(true);
                setContracts(e.target.value.replace(/\D/g, ""));
              }}
              placeholder="e.g., 2"
            />
            <p
              id="add-contracts-help"
              className={`text-xs mt-1 h-6 ${contractsTouched && !contractsValid ? "text-red-600" : "text-muted-foreground"}`}
            >
              {contractsTouched && !contractsValid
                ? contractsErr
                : "Whole numbers only"}
            </p>
          </div>

          {/* Price */}
          <div className="mt-4">
            <Label className="text-sm whitespace-nowrap">
              Price per Contract
            </Label>
            <div onKeyDown={handlePriceKeyDown}>
              <CurrencyInput
                value={price}
                onChange={(v) => {
                  setPriceTouched(true);
                  setPrice(v);
                }}
                placeholder="e.g., 0.85"
              />
            </div>
            <p
              className={`text-xs mt-1 h-6 ${priceTouched && !priceValid ? "text-red-600" : "text-muted-foreground"}`}
            >
              {priceTouched && !priceValid
                ? priceErr
                : "Enter per‑contract price"}
            </p>
          </div>

          {/* Submit */}
          <div className="mt-6">
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
            >
              {submitting ? "Updating…" : "Submit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
