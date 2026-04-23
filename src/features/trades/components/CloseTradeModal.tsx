"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Trade } from "@/types";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/ui/currency-input";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { mutate } from "swr";
import { TypeBadge } from "@/features/trades/components/TypeBadge";

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
  refresh?: () => void;
}

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
  const [assigned, setAssigned] = useState(false);
  const [expiredWorthless, setExpiredWorthless] = useState(false);
  const [contractsToClose, setContractsToClose] = useState(contracts);
  const [closingPrice, setClosingPrice] = useState({ formatted: "", raw: 0 });

  const [contractsTouched, setContractsTouched] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFullClose(true);
      setAssigned(false);
      setExpiredWorthless(false);
      setContractsToClose(contracts);
      setClosingPrice({ formatted: "", raw: 0 });
      setSubmitting(false);
      setContractsTouched(false);
      setPriceTouched(false);
    }
  }, [isOpen, contracts]);

  useEffect(() => {
    if (!isOpen) return;
    if (!assigned && !expiredWorthless) return;
    setFullClose(true);
    setContractsToClose(contracts);
    setClosingPrice({ formatted: "0.00", raw: 0 });
    setPriceTouched(false);
  }, [assigned, expiredWorthless, isOpen, contracts]);

  const { data: tradeData } = useSWR<Trade>(
    isOpen ? `/api/trades/${id}` : null,
    (url: string) => fetch(url).then((r) => r.json()),
    { dedupingInterval: 10_000 },
  );

  const displayTicker = ticker ?? tradeData?.ticker ?? "";
  const displayType = type ?? tradeData?.type ?? "";

  const tradeType = type ?? tradeData?.type;
  const isCSP = tradeType === "CashSecuredPut";
  const isCC = tradeType === "CoveredCall";
  const isShortOption = isCSP || isCC;

  const displayAvgPrice = tradeData?.contractPrice;
  const displayExpiration =
    expirationDate ??
    (tradeData?.expirationDate ? String(tradeData.expirationDate) : undefined);

  const effectiveContracts = fullClose ? contracts : contractsToClose;

  const contractsValid =
    isPositiveInt(effectiveContracts) &&
    Number(effectiveContracts) <= contracts;
  const forcedZero = assigned || expiredWorthless;
  const priceValid = forcedZero ? Number(closingPrice.raw) >= 0 : Number(closingPrice.raw) > 0;
  const canSubmit = contractsValid && priceValid;

  const contractsErr = !contractsValid
    ? !isPositiveInt(effectiveContracts)
      ? "Enter a valid whole number of contracts."
      : Number(effectiveContracts) > contracts
        ? `Cannot close more than ${contracts} contracts.`
        : ""
    : "";

  const priceErr = !priceValid
    ? forcedZero
      ? "Closing price must be 0.00."
      : "Enter a valid closing price."
    : "";

  const handleSubmit = async () => {
    if (!canSubmit) {
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
          closingContracts: Number(forcedZero ? contracts : effectiveContracts),
          closingContractPrice: Number(forcedZero ? 0 : closingPrice.raw),
          fullClose: forcedZero ? true : fullClose,
          assignment: assigned ? true : undefined,
          closeReason: assigned ? "assigned" : expiredWorthless ? "expiredWorthless" : "manual",
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Error closing trade");
      }

      await Promise.allSettled([
        mutate(`/api/trades/${id}`),
        mutate(`/api/trades?portfolioId=${portfolioId}&status=open`),
        mutate(`/api/trades?portfolioId=${portfolioId}&status=closed`),
        mutate(`/api/stocks?portfolioId=${encodeURIComponent(portfolioId)}&status=open`),
        mutate(`/api/stocks?portfolioId=${encodeURIComponent(portfolioId)}&status=closed`),
        mutate(`/api/portfolios/${portfolioId}/metrics`),
        mutate(`/api/portfolios/${portfolioId}/detail-metrics`),
        mutate("/api/account/summary"),
        mutate("/api/portfolios"),
      ]);

      router.refresh();
      toast.success("Position closed successfully!");
      onClose();
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
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            Close Position{displayTicker ? ` — ${displayTicker}` : ""}
          </DialogTitle>
          <DialogDescription>
            Record the closing price to calculate realized P/L.
          </DialogDescription>
        </DialogHeader>

        {/* Trade summary */}
        <div className="bg-muted/50 rounded-lg border p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Type</span>
            {displayType ? <TypeBadge type={displayType} /> : <span>—</span>}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Strike</span>
            <span className="font-medium">${strikePrice.toFixed(2)}</span>
          </div>
          {typeof displayAvgPrice === "number" && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg Price</span>
              <span className="font-medium">${displayAvgPrice.toFixed(2)}</span>
            </div>
          )}
          {displayExpiration && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expiration</span>
              <span className="font-medium">
                {format(new Date(displayExpiration), "MMM d, yyyy")}
              </span>
            </div>
          )}
        </div>

        {/* Contracts + Price inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="contractsToClose">Contracts</Label>
            <Input
              id="contractsToClose"
              type="text"
              inputMode="numeric"
              disabled={!!fullClose || assigned}
              aria-invalid={contractsTouched && !contractsValid}
              value={
                fullClose
                  ? String(contracts)
                  : contractsToClose === 0
                    ? ""
                    : String(contractsToClose)
              }
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
            />
            <p
              className={`text-xs h-4 ${contractsTouched && !contractsValid ? "text-destructive" : "text-muted-foreground"}`}
            >
              {contractsTouched && !contractsValid
                ? contractsErr
                : fullClose
                  ? "Closing all contracts"
                  : `Max: ${contracts}`}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Close Price</Label>
            <div
              onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.key === "Enter") handleSubmit();
              }}
            >
              <CurrencyInput
                value={closingPrice}
                onChange={(v) => {
                  if (forcedZero) return;
                  setPriceTouched(true);
                  setClosingPrice(v);
                }}
                placeholder={forcedZero ? "0.00" : "e.g. 0.20"}
                disabled={forcedZero}
              />
            </div>
            <p
              className={`text-xs h-4 ${priceTouched && !priceValid ? "text-destructive" : "text-muted-foreground"}`}
            >
              {priceTouched && !priceValid
                ? priceErr
                : forcedZero
                  ? "Closes at 0.00"
                  : "Per‑contract price"}
            </p>
          </div>
        </div>

        {/* Outcome checkboxes */}
        <div className="space-y-2 pt-1">
          {isShortOption && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={expiredWorthless}
                disabled={assigned}
                onCheckedChange={(v) => {
                  const checked = !!v;
                  setExpiredWorthless(checked);
                  if (checked) setAssigned(false);
                }}
              />
              <span className="text-xs text-muted-foreground">
                Expired worthless — full premium captured
              </span>
            </label>
          )}

          {isCSP && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={assigned}
                disabled={expiredWorthless}
                onCheckedChange={(v) => {
                  const checked = !!v;
                  setAssigned(checked);
                  if (checked) setExpiredWorthless(false);
                }}
              />
              <span className="text-xs text-muted-foreground">
                Assigned — stock put to you (creates a stock lot)
              </span>
            </label>
          )}

          {isCC && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={assigned}
                disabled={expiredWorthless}
                onCheckedChange={(v) => {
                  const checked = !!v;
                  setAssigned(checked);
                  if (checked) setExpiredWorthless(false);
                }}
              />
              <span className="text-xs text-muted-foreground">
                Assigned — stock called away (closes the stock lot)
              </span>
            </label>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={fullClose}
              disabled={forcedZero}
              onCheckedChange={(v) => {
                const isChecked = !!v;
                setFullClose(isChecked);
                setContractsTouched(true);
                if (isChecked) setContractsToClose(contracts);
              }}
            />
            <span className="text-xs text-muted-foreground">
              Close full position
            </span>
          </label>

          {assigned && isCSP && (
            <p className="text-xs text-muted-foreground pl-6">
              Closes the CSP at 100% premium capture and opens a stock lot at the net basis (strike − premium).
            </p>
          )}
          {assigned && isCC && (
            <p className="text-xs text-muted-foreground pl-6">
              Closes the covered call and marks the linked stock lot as sold at the strike price.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !canSubmit}>
            {submitting ? "Submitting…" : "Close Position"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CloseTradeModal;
