"use client";

import * as React from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import type { CreateStockBody } from "@/types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";

type Props = {
  portfolioId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddStockModal({ portfolioId, open, onOpenChange }: Props) {
  const [ticker, setTicker] = React.useState<string>("");
  const [shares, setShares] = React.useState<string>("");
  const [avgCost, setAvgCost] = React.useState<{ formatted: string; raw: number }>({
    formatted: "",
    raw: 0,
  });
  const [notes, setNotes] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  const reset = React.useCallback(() => {
    setTicker("");
    setShares("");
    setAvgCost({ formatted: "", raw: 0 });
    setNotes("");
  }, []);

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const t = ticker.trim().toUpperCase();
    const s = Number(shares);

    if (!t) return toast.error("Ticker is required");
    if (!Number.isFinite(s) || s <= 0 || !Number.isInteger(s)) {
      return toast.error("Shares must be a positive whole number");
    }
    if (!Number.isFinite(avgCost.raw) || avgCost.raw <= 0) {
      return toast.error("Avg cost must be a positive number");
    }

    const payload: CreateStockBody = {
      portfolioId,
      ticker: t,
      shares: s,
      avgCost: avgCost.raw,
      notes: notes.trim() ? notes.trim() : null,
    };

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }

      await res.json();

      const key = `/api/stocks?portfolioId=${encodeURIComponent(portfolioId)}&status=open`;
      await mutate(key);

      toast.success("Stock position added");
      onOpenChange(false);
      reset();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add stock position");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Stock</DialogTitle>
          <DialogDescription>
            Track assigned shares or any underlying position with avg cost and notes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ticker">Ticker</Label>
              <Input
                id="ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="NVDA"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="shares">Shares</Label>
              <Input
                id="shares"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="200"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avgCost">Avg Cost</Label>
              <CurrencyInput
                value={avgCost}
                onChange={setAvgCost}
                placeholder="142.61"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Assigned from CSP…"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
