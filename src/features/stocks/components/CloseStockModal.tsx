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
import { Input } from "@/components/ui/input";
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
  openCcShares?: number;
}

export function CloseStockLotModal({
  open,
  onOpenChange,
  stockId,
  portfolioId,
  ticker,
  shares,
  avgCost,
  openCcShares = 0,
}: CloseStockLotModalProps) {
  const maxSellable = shares - openCcShares;

  const [closePrice, setClosePrice] = React.useState<{ formatted: string; raw: number }>({
    formatted: "",
    raw: 0,
  });
  const [sharesToClose, setSharesToClose] = React.useState<number>(maxSellable);
  const [isClosing, setIsClosing] = React.useState<boolean>(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setSharesToClose(maxSellable);
      setClosePrice({ formatted: "", raw: 0 });
    }
  }, [open, maxSellable]);

  const validClosePrice = Number.isFinite(closePrice.raw) && closePrice.raw > 0;
  const validShares =
    Number.isFinite(sharesToClose) &&
    sharesToClose > 0 &&
    sharesToClose <= maxSellable;

  const isFullClose = sharesToClose === shares;
  const proceeds = validClosePrice && validShares ? closePrice.raw * sharesToClose : NaN;
  const costBasis = validShares ? avgCost * sharesToClose : NaN;
  const estPL = validClosePrice && validShares ? (closePrice.raw - avgCost) * sharesToClose : NaN;
  const plPositive = Number.isFinite(estPL) && estPL >= 0;

  async function handleClose() {
    if (!validClosePrice) {
      toast.error("Please enter a valid close price.");
      return;
    }
    if (!validShares) {
      toast.error(`Shares must be between 1 and ${maxSellable}.`);
      return;
    }

    setIsClosing(true);
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(stockId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closePrice: closePrice.raw,
          sharesToClose,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to sell shares (${res.status})`);
      }

      if (isFullClose) {
        toast.success(`Closed ${ticker} stock lot.`);
      } else {
        toast.success(`Sold ${sharesToClose} shares of ${ticker}.`);
      }
      onOpenChange(false);

      await Promise.allSettled([
        mutate(`/api/stocks/${stockId}`),
        mutate(`/api/stocks?portfolioId=${encodeURIComponent(portfolioId)}&status=open`),
        mutate(`/api/stocks?portfolioId=${encodeURIComponent(portfolioId)}&status=closed`),
        mutate(`/api/trades?portfolioId=${portfolioId}&status=closed`),
        mutate(`/api/portfolios/${portfolioId}/metrics`),
        mutate(`/api/portfolios/${portfolioId}/detail-metrics`),
        mutate("/api/account/summary"),
        mutate("/api/portfolios"),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to sell shares";
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
          <DialogTitle>Sell Shares</DialogTitle>
          <DialogDescription>
            {isFullClose
              ? "Closes the entire lot and records realized share P/L."
              : "Partially sells shares and records realized P/L for the sold portion."}
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
              <span className="text-muted-foreground">Total Shares</span>
              <span className="font-medium">{shares}</span>
            </div>
            {openCcShares > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Covered by Open CCs</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {openCcShares} shares
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sellable Shares</span>
              <span className="font-medium">{maxSellable}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg Cost</span>
              <span className="font-medium">{money(avgCost)}</span>
            </div>
          </div>

          {/* Shares to sell */}
          <div className="space-y-1.5">
            <Label htmlFor="sharesToClose">Shares to Sell</Label>
            <Input
              id="sharesToClose"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxSellable}
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={sharesToClose === 0 ? "" : sharesToClose.toString()}
              onChange={(e) => {
                const val = e.target.value;
                if (/^(0|[1-9][0-9]*)?$/.test(val)) {
                  setSharesToClose(val === "" ? 0 : Number(val));
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Max {maxSellable} share{maxSellable !== 1 ? "s" : ""}
              {openCcShares > 0 ? ` (${openCcShares} reserved for open covered calls)` : ""}
            </p>
          </div>

          {/* Close price input */}
          <div className="space-y-1.5">
            <Label htmlFor="closePrice">Sell Price (per share)</Label>
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
            {!isFullClose && validShares && (
              <div className="flex items-center justify-between pt-1 border-t border-border/60 mt-1">
                <span className="text-muted-foreground">Remaining Shares</span>
                <span className="font-medium">{shares - sharesToClose}</span>
              </div>
            )}
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
            disabled={!validClosePrice || !validShares || isClosing}
          >
            {isClosing
              ? "Selling…"
              : isFullClose
                ? "Close Stock Lot"
                : `Sell ${validShares ? sharesToClose : ""} Shares`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
