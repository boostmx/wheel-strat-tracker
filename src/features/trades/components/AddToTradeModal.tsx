"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  onUpdated?: () => void;
};

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

  const contractsErr = !contractsValid ? "Enter a valid whole number of contracts." : "";
  const priceErr = !priceValid ? "Enter a valid price per contract." : "";

  const handleSubmit = async () => {
    if (!canSubmit) {
      setContractsTouched(true);
      setPriceTouched(true);
      toast.error(contractsErr || priceErr || "Fix errors before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/trades/${tradeId}/add`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addedContracts: Number(contracts),
          addedContractPrice: Number(price.raw),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Unable to add to trade");
      }

      await Promise.allSettled([
        mutate(`/api/trades/${tradeId}`),
        mutate(`/api/trades?portfolioId=${portfolioId}&status=open`),
        mutate(`/api/portfolios/${portfolioId}/metrics`),
        mutate(`/api/portfolios/${portfolioId}/detail-metrics`),
        mutate("/api/account/summary"),
        mutate("/api/portfolios"),
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            Add to Position{ticker ? ` — ${ticker}` : ""}
          </DialogTitle>
          <DialogDescription>
            Average down or scale into this position.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg border p-3 text-sm space-y-0.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Contracts</span>
            <span className="font-medium">{currentContracts}</span>
          </div>
          {typeof avgContractPrice === "number" && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Price</span>
              <span className="font-medium">${avgContractPrice.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-contracts">Contracts to Add</Label>
            <Input
              id="add-contracts"
              type="text"
              inputMode="numeric"
              aria-invalid={contractsTouched && !contractsValid}
              value={contracts}
              onBlur={() => setContractsTouched(true)}
              onChange={(e) => {
                setContractsTouched(true);
                setContracts(e.target.value.replace(/\D/g, ""));
              }}
              placeholder="e.g. 2"
            />
            <p
              className={`text-xs h-4 ${contractsTouched && !contractsValid ? "text-destructive" : "text-muted-foreground"}`}
            >
              {contractsTouched && !contractsValid ? contractsErr : "Whole numbers only"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Price per Contract</Label>
            <div
              onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.key === "Enter") handleSubmit();
              }}
            >
              <CurrencyInput
                value={price}
                onChange={(v) => {
                  setPriceTouched(true);
                  setPrice(v);
                }}
                placeholder="e.g. 0.85"
              />
            </div>
            <p
              className={`text-xs h-4 ${priceTouched && !priceValid ? "text-destructive" : "text-muted-foreground"}`}
            >
              {priceTouched && !priceValid ? priceErr : "Enter per‑contract price"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !canSubmit}>
            {submitting ? "Updating…" : "Add to Position"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
