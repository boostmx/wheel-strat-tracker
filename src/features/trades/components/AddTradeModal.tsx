"use client";

import React, { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { CurrencyInput } from "@/components/ui/currency-input";

type StockLotStatus = "OPEN" | "CLOSED";

type StockLot = {
  id: string;
  ticker: string;
  shares: number;
  avgCost: string | number;
  status: StockLotStatus;
};

type StocksListResponse = {
  stockLots: StockLot[];
};

async function fetchStocks(url: string): Promise<StocksListResponse> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as StocksListResponse;
}

function toNumber(v: string | number): number {
  return typeof v === "number" ? v : Number(v);
}

function formatAvgCost(v: string | number): string {
  const n = toNumber(v);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type TradeTypeValue = "CashSecuredPut" | "CoveredCall" | "Put" | "Call";

type AddTradePrefill = {
  ticker?: string;
  type?: TradeTypeValue;
  stockLotId?: string;
  contracts?: number;
};

type AddTradeModalProps = {
  portfolioId: string;
  trigger?: React.ReactNode;
  prefill?: AddTradePrefill;
  lockPrefill?: boolean;
};

export function AddTradeModal({
  portfolioId,
  trigger,
  prefill,
  lockPrefill = false,
}: AddTradeModalProps) {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState<string>(prefill?.ticker ?? "");
  const [strikePrice, setStrikePrice] = useState({ formatted: "", raw: 0 });
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();

  const tradeTypeOptions = [
    { label: "Cash Secured Put", value: "CashSecuredPut" },
    { label: "Covered Call", value: "CoveredCall" },
    { label: "Put", value: "Put" },
    { label: "Call", value: "Call" },
  ];

  const [type, setType] = useState<TradeTypeValue>(
    prefill?.type ?? "CashSecuredPut",
  );

  const [stockLotId, setStockLotId] = useState<string>(prefill?.stockLotId ?? "");

  const { data: stocksData } = useSWR<StocksListResponse>(
    open ? `/api/stocks?portfolioId=${portfolioId}&status=open` : null,
    fetchStocks,
  );

  const openStockLots = stocksData?.stockLots ?? [];
  const tickerUpper = (prefill?.ticker ?? ticker).trim().toUpperCase();
  const matchingStockLots = tickerUpper
    ? openStockLots.filter((l) => l.ticker.toUpperCase() === tickerUpper)
    : openStockLots;

  const [contracts, setContracts] = useState<number>(prefill?.contracts ?? 1);
  const [contractPrice, setContractPrice] = useState({ formatted: "", raw: 0 });
  const [entryPrice, setEntryPrice] = useState({ formatted: "", raw: 0 });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (prefill?.ticker != null) setTicker(prefill.ticker.toUpperCase());
      if (prefill?.type != null) {
        setType(prefill.type);
        if (prefill.type !== "CoveredCall") setStockLotId("");
      }
      if (prefill?.stockLotId != null) setStockLotId(prefill.stockLotId);
      if (prefill?.contracts != null) setContracts(prefill.contracts);
      return;
    }

    setTicker("");
    setStrikePrice({ formatted: "", raw: 0 });
    setExpirationDate(undefined);
    setType("CashSecuredPut");
    setStockLotId("");
    setContracts(1);
    setContractPrice({ formatted: "", raw: 0 });
    setEntryPrice({ formatted: "", raw: 0 });
    setIsLoading(false);
  }, [open, prefill]);

  function handleTypeChange(nextType: string) {
    if (lockPrefill && prefill?.type) return;
    const casted = nextType as TradeTypeValue;
    setType(casted);
    if (casted !== "CoveredCall") {
      setStockLotId("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!expirationDate) {
      toast.error("Please select an expiration date.");
      return;
    }

    if (type === "CoveredCall" && !stockLotId) {
      toast.error("Please select an underlying stock lot for covered calls.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        body: JSON.stringify({
          portfolioId,
          ticker,
          strikePrice: strikePrice.raw,
          expirationDate: expirationDate.toISOString(),
          type,
          contracts: Number(contracts),
          contractPrice: contractPrice.raw,
          entryPrice: entryPrice.raw,
          stockLotId: type === "CoveredCall" ? stockLotId : undefined,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add trade");
      }

      toast.success("Trade added successfully!");
      setOpen(false);
      mutate(`/api/trades?portfolioId=${portfolioId}&status=open`);
      mutate(`/api/portfolios/${portfolioId}/metrics`);
      mutate(`/api/portfolios/${portfolioId}/detail-metrics`);
      mutate("/api/account/summary");
      mutate("/api/portfolios");
      if (type === "CoveredCall" && stockLotId) {
        mutate(`/api/stocks/${stockLotId}`);
      }
    } catch (err) {
      toast.error("Failed to add trade");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">+ Add Trade</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add New Trade</DialogTitle>
          <DialogDescription>
            Log an options trade to track premiums and P/L.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ticker">Ticker</Label>
              <Input
                id="ticker"
                placeholder="e.g. META"
                value={ticker}
                disabled={lockPrefill && !!prefill?.ticker}
                onChange={(e) => {
                  if (lockPrefill && prefill?.ticker) return;
                  setTicker(e.target.value.toUpperCase());
                }}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type">Option Type</Label>
              <Select
                value={type}
                onValueChange={handleTypeChange}
                disabled={lockPrefill && !!prefill?.type}
              >
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tradeTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="strikePrice">Strike Price</Label>
              <CurrencyInput
                value={strikePrice}
                onChange={setStrikePrice}
                placeholder="e.g. $170"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entryPrice">Stock Entry Price</Label>
              <CurrencyInput
                value={entryPrice}
                onChange={setEntryPrice}
                placeholder="e.g. $184.34"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expirationDate">Expiration Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expirationDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expirationDate
                    ? format(expirationDate, "PPP")
                    : "Pick expiration date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expirationDate}
                  onSelect={setExpirationDate}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {type === "CoveredCall" && (
            <div className="space-y-1.5">
              <Label htmlFor="stockLotId">Underlying Stock Lot</Label>
              <Select
                value={stockLotId}
                onValueChange={setStockLotId}
                disabled={lockPrefill && !!prefill?.stockLotId}
              >
                <SelectTrigger id="stockLotId" className="w-full">
                  <SelectValue placeholder="Select a stock lot…" />
                </SelectTrigger>
                <SelectContent>
                  {matchingStockLots.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.ticker} — {lot.shares} sh @ ${formatAvgCost(lot.avgCost)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tickerUpper && matchingStockLots.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No open stock lots found for {tickerUpper}. Add a stock position first.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contracts"># of Contracts</Label>
              <Input
                id="contracts"
                type="number"
                inputMode="numeric"
                min={1}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={contracts === 0 ? "" : contracts.toString()}
                disabled={lockPrefill && !!prefill?.contracts}
                onChange={(e) => {
                  if (lockPrefill && prefill?.contracts != null) return;
                  const val = e.target.value;
                  if (/^(0|[1-9][0-9]*)?$/.test(val)) {
                    setContracts(val === "" ? 0 : Number(val));
                  }
                }}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contractPrice">Premium per Contract</Label>
              <CurrencyInput
                value={contractPrice}
                onChange={setContractPrice}
                placeholder="e.g. $2.40"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding…" : "Add Trade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
