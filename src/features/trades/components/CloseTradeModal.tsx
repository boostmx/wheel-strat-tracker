"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { metricsKey, openTradesKey, closedTradesKey } from "@/lib/swrKeys";

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

  useEffect(() => {
    if (isOpen) {
      setFullClose(true);
      setContractsToClose(contracts);
      setClosingPrice({ formatted: "", raw: 0 });
      setSubmitting(false);
    }
  }, [isOpen, contracts]);

  const handleSubmit = async () => {
    const numContracts = Number(contractsToClose);
    const price = Number(closingPrice.raw);

    if (!price || numContracts <= 0 || numContracts > contracts) {
      toast.error("Invalid closing price or contract count");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`/api/trades/${id}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingContracts: numContracts,
          closingContractPrice: price,
          fullClose,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Error closing trade");
      }

      // Revalidate all dependent data
      await Promise.allSettled([
        mutate(metricsKey(portfolioId)),
        mutate(openTradesKey(portfolioId)),
        mutate(closedTradesKey(portfolioId)),
      ]);

      // If any cards are server-rendered, force a refresh as well
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
            Close Position
          </DialogTitle>
        </DialogHeader>

        {/* Trade summary */}
        <div className="bg-muted rounded-md px-4 py-3 text-sm mb-4 space-y-1">
          {ticker && (
            <p>
              <span className="font-medium">Ticker:</span> {ticker}
            </p>
          )}
          {type && (
            <p>
              <span className="font-medium">Type:</span> {type}
            </p>
          )}
          <p>
            <span className="font-medium">Strike:</span> $
            {strikePrice.toFixed(2)}
          </p>
          <p>
            <span className="font-medium">Contracts:</span> {contracts}
          </p>
          {expirationDate && (
            <p>
              <span className="font-medium">Expiration:</span>{" "}
              {format(new Date(expirationDate), "MMM d, yyyy")}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <label className="flex items-center space-x-2">
            <Checkbox
              checked={fullClose}
              onCheckedChange={(v) => {
                const isChecked = !!v;
                setFullClose(isChecked);
                if (isChecked) setContractsToClose(contracts);
              }}
            />
            <span>Close full position</span>
          </label>

          {!fullClose && (
            <div className="space-y-1.5">
              <Label htmlFor="contractsToClose"># of Contracts to Close</Label>
              <Input
                id="contractsToClose"
                type="number"
                inputMode="numeric"
                min={1}
                max={contracts}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={contractsToClose === 0 ? "" : String(contractsToClose)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^(0|[1-9][0-9]*)?$/.test(val)) {
                    const num = val === "" ? 0 : Number(val);
                    if (num <= contracts) setContractsToClose(num);
                  }
                }}
                required
              />
            </div>
          )}

          <CurrencyInput
            value={closingPrice}
            onChange={setClosingPrice}
            placeholder="Closing price per contract"
          />

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CloseTradeModal;
