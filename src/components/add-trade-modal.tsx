"use client";

import { useState } from "react";
import { CurrencyInput } from "@/components/ui/currency-input";
import { mutate } from "swr";

import {
  Dialog,
  DialogContent,
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

import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * Add Trade Modal Component
 * @param param0 - The portfolio ID to which the trade will be added
 * @returns
 */
export function AddTradeModal({ portfolioId }: { portfolioId: string }) {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [strikePrice, setStrikePrice] = useState({ formatted: "", raw: 0 });
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();

  //Options for trade types on select dropdown
  const tradeTypeOptions = [
    { label: "Cash Secured Put", value: "CashSecuredPut" },
    { label: "Covered Call", value: "CoveredCall" },
    { label: "Put", value: "Put" },
    { label: "Call", value: "Call" },
  ];

  const [type, setType] = useState("CashSecuredPut");

  const [contracts, setContracts] = useState(1);
  const [contractPrice, setContractPrice] = useState({ formatted: "", raw: 0 });
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        body: JSON.stringify({
          portfolioId,
          ticker,
          strikePrice: strikePrice.raw,
          expirationDate: expirationDate?.toISOString(),
          type,
          contracts: Number(contracts),
          contractPrice: contractPrice.raw,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!expirationDate) {
        toast.error("Please select an expiration date.");
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add trade");
      }

      toast.success("Trade added successfully!");
      setOpen(false);
      setTicker("");
      setStrikePrice({ formatted: "", raw: 0 });
      setExpirationDate(undefined);
      setContracts(1);
      setContractPrice({ formatted: "", raw: 0 });
      mutate(`/api/trades?portfolioId=${portfolioId}&status=open`);
      mutate(["portfolioMetrics", portfolioId]);
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
        <Button variant="outline">+ Add Trade</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Trade</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ticker">Ticker</Label>
            <Input
              id="ticker"
              placeholder="e.g. META"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="strikePrice">Strike Price</Label>

            <CurrencyInput
              value={strikePrice}
              onChange={setStrikePrice}
              placeholder="e.g. $170"
            />
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
                    : "Pick a trade date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expirationDate}
                  onSelect={setExpirationDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">Option Type</Label>
            <select
              id="type"
              className="w-full border rounded px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
              required
            >
              {tradeTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contracts"># of Contracts</Label>
            <Input
              id="contracts"
              type="number"
              inputMode="numeric"
              min={1}
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={contracts === 0 ? "" : contracts.toString()}
              onChange={(e) => {
                const val = e.target.value;
                // Only allow digits, no leading zeros unless it's '0' by itself
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

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Adding..." : "Add Trade"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
