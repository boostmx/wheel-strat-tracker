"use client";

import * as React from "react";
import { mutate } from "swr";
import { toast } from "sonner";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function formatMoney(n: number): string {
  return Number.isFinite(n) ? money(n) : "—";
}

export interface CloseStockLotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockId: string;
  portfolioId: string;
  ticker: string;
  shares: number;
  avgCost: number;
}

export function CloseStockLotModal({
  open,
  onOpenChange,
  stockId,
  portfolioId,
  ticker,
  shares,
  avgCost,
}: CloseStockLotModalProps) {
  const [closePrice, setClosePrice] = React.useState<{ formatted: string; raw: number }>({
    formatted: "",
    raw: 0,
  });
  const [isClosing, setIsClosing] = React.useState<boolean>(false);

  const validClosePrice = Number.isFinite(closePrice.raw) && closePrice.raw > 0;

  const proceeds = validClosePrice ? closePrice.raw * shares : NaN;
  const costBasis = avgCost * shares;
  const estPL = validClosePrice ? (closePrice.raw - avgCost) * shares : NaN;
  const plPositive = Number.isFinite(estPL) && estPL >= 0;

  async function handleClose() {
    if (!validClosePrice) {
      toast.error("Please enter a valid close price.");
      return;
    }

    setIsClosing(true);
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(stockId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closePrice: closePrice.raw }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to close stock lot (${res.status})`);
      }

      toast.success(`Closed ${ticker} stock lot.`);
      onOpenChange(false);
      setClosePrice({ formatted: "", raw: 0 });

      await Promise.all([
        mutate(`/api/stocks/${stockId}`),
        mutate(`/api/stocks?portfolioId=${encodeURIComponent(portfolioId)}&status=open`),
        mutate(`/api/stocks?portfolioId=${encodeURIComponent(portfolioId)}&status=closed`),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to close stock lot";
      toast.error(msg);
    } finally {
      setIsClosing(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setClosePrice({ formatted: "", raw: 0 });
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Close Stock Lot</DialogTitle>
          <DialogDescription>
            Closes the entire lot and records realized share P/L using your current average cost.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Position summary */}
          <div className="bg-muted/50 rounded-lg border p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ticker</span>
              <span className="font-semibold">{ticker}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Shares</span>
              <span className="font-medium">{shares}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg Cost</span>
              <span className="font-medium">{money(avgCost)}</span>
            </div>
          </div>

          {/* Close price input */}
          <div className="space-y-1.5">
            <Label htmlFor="closePrice">Close Price (per share)</Label>
            <CurrencyInput
              value={closePrice}
              onChange={setClosePrice}
              placeholder="e.g. 155.25"
            />
          </div>

          {/* Calculated summary */}
          <div className="bg-muted/50 rounded-lg border p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated Proceeds</span>
              <span className="font-medium">{formatMoney(proceeds)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cost Basis</span>
              <span className="font-medium">{formatMoney(costBasis)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated Share P/L</span>
              <span
                className={cn(
                  "font-semibold",
                  Number.isFinite(estPL)
                    ? plPositive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                    : "",
                )}
              >
                {formatMoney(estPL)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isClosing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleClose}
            disabled={!validClosePrice || isClosing}
          >
            {isClosing ? "Closing…" : "Close Stock Lot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
