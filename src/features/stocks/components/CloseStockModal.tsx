"use client";

import * as React from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [closePrice, setClosePrice] = React.useState<string>("");
  const [isClosing, setIsClosing] = React.useState<boolean>(false);

  const closePriceNum = Number(closePrice);
  const validClosePrice = Number.isFinite(closePriceNum) && closePriceNum > 0;

  const proceeds = validClosePrice ? closePriceNum * shares : NaN;
  const costBasis = avgCost * shares;
  const estPL = validClosePrice ? (closePriceNum - avgCost) * shares : NaN;

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
        body: JSON.stringify({ closePrice: closePriceNum }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to close stock lot (${res.status})`);
      }

      toast.success(`Closed ${ticker} stock lot.`);
      onOpenChange(false);
      setClosePrice("");

      await Promise.all([
        mutate(`/api/stocks/${stockId}`),
        mutate(
          `/api/stocks?portfolioId=${encodeURIComponent(portfolioId)}&status=open`,
        ),
        mutate(
          `/api/stocks?portfolioId=${encodeURIComponent(portfolioId)}&status=closed`,
        ),
      ]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to close stock lot";
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
        if (!next) setClosePrice("");
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Close Stock Lot</DialogTitle>
          <DialogDescription>
            This closes the entire lot and computes realized share P/L using your
            current average cost.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ticker</span>
              <span className="font-medium">{ticker}</span>
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

          <div className="space-y-1.5">
            <Label htmlFor="closePrice">Close Price (per share)</Label>
            <Input
              id="closePrice"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={closePrice}
              onChange={(e) => setClosePrice(e.target.value)}
              placeholder="e.g. 155.25"
            />
          </div>

          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated Proceeds</span>
              <span className="font-medium">
                {formatMoney(proceeds)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cost Basis</span>
              <span className="font-medium">
                {formatMoney(costBasis)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Estimated Share P/L
              </span>
              <span className="font-semibold">
                {formatMoney(estPL)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}