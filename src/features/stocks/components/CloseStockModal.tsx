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
  const [sharesToSell, setSharesToSell] = React.useState<string>(String(shares));
  const [notes, setNotes] = React.useState<string>("");
  const [isClosing, setIsClosing] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (open) {
      setSharesToSell(String(shares));
    } else {
      setClosePrice("");
      setSharesToSell(String(shares));
      setNotes("");
    }
  }, [open, shares]);

  const closePriceNum = Number(closePrice);
  const sharesToSellNum = Math.trunc(Number(sharesToSell));
  const notesTrimmed = notes.trim();

  const validSharesToSell =
    sharesToSell !== "" &&
    Number.isInteger(sharesToSellNum) &&
    sharesToSellNum > 0 &&
    sharesToSellNum <= shares;
  const validSalePrice = Number.isFinite(closePriceNum) && closePriceNum > 0;

  const canSubmit = validSharesToSell && validSalePrice && !isClosing;

  const proceeds = validSalePrice && validSharesToSell ? closePriceNum * sharesToSellNum : NaN;
  const costBasis = avgCost * (validSharesToSell ? sharesToSellNum : 0);
  const estPL = validSalePrice && validSharesToSell ? (closePriceNum - avgCost) * sharesToSellNum : NaN;
  const remainingShares = validSharesToSell ? shares - sharesToSellNum : NaN;

  async function handleClose() {
    if (!validSharesToSell) {
      toast.error("Please enter a valid number of shares to sell.");
      return;
    }
    if (!validSalePrice) {
      toast.error("Please enter a valid sale price.");
      return;
    }

    setIsClosing(true);
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(stockId)}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharesSold: sharesToSellNum,
          salePrice: closePriceNum,
          notes: notesTrimmed ? notesTrimmed : undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to sell shares (${res.status})`);
      }

      if (sharesToSellNum === shares) {
        toast.success(`Sold ${sharesToSellNum} ${ticker} shares and closed the lot.`);
      } else {
        toast.success(`Sold ${sharesToSellNum} ${ticker} shares.`);
      }
      onOpenChange(false);
      setClosePrice("");
      setSharesToSell(String(shares));
      setNotes("");

      await Promise.all([
        mutate(`/api/stocks/${stockId}`),
        mutate(
          `/api/stocks?portfolioId=${encodeURIComponent(portfolioId)}&status=open`,
        ),
        mutate(
          `/api/stocks?portfolioId=${encodeURIComponent(portfolioId)}&status=closed`,
        ),
        mutate(`/api/portfolios/${portfolioId}/detail-metrics`),
        mutate(`/api/portfolios/${portfolioId}/metrics`),
      ]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to sell shares";
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
        if (!next) {
          setClosePrice("");
          setSharesToSell(String(shares));
          setNotes("");
        }
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Sell Shares</DialogTitle>
          <DialogDescription>
            This will sell shares from the lot and compute realized share P/L using your
            current average cost. If you sell all shares, the lot will close.
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
            <Label htmlFor="sharesToSell">Shares to Sell</Label>
            <Input
              id="sharesToSell"
              type="text"
              inputMode="numeric"
              value={sharesToSell}
              onChange={(e) => {
                const val = e.target.value;
                if (/^(0|[1-9][0-9]*)?$/.test(val)) {
                  if (val === "") {
                    setSharesToSell(val);
                  } else {
                    const numVal = Number(val);
                    if (numVal <= shares) {
                      setSharesToSell(val);
                    }
                  }
                }
              }}
              placeholder={`Max: ${shares}`}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="closePrice">Sale Price (per share)</Label>
            <Input
              id="closePrice"
              type="text"
              inputMode="decimal"
              value={closePrice}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*(\.\d{0,2})?$/.test(val)) {
                  setClosePrice(val);
                }
              }}
              placeholder="e.g. 155.25"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes"
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

          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Shares Selling</span>
              <span className="font-medium">
                {validSharesToSell ? sharesToSellNum : "—"}
              </span>
            </div>
            {validSharesToSell && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Remaining Shares</span>
                <span className="font-medium">{remainingShares}</span>
              </div>
            )}
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
              disabled={!canSubmit}
            >
              {isClosing ? "Selling…" : "Sell Shares"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}