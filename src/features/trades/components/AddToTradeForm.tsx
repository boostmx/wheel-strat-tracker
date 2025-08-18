"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "sonner";

export default function AddToTradeForm({
  tradeId,
  //portfolioId,
  onSuccess,
}: {
  tradeId: string;
  //portfolioId: string;
  onSuccess?: () => void;
}) {
  const [contracts, setContracts] = useState("");
  const [price, setPrice] = useState({ formatted: "", raw: 0 });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const addedContracts = Number(contracts);
    const addedContractPrice =
      typeof price === "object" && price !== null
        ? Number(price.raw)
        : Number(price as unknown as number);

    if (!Number.isFinite(addedContracts) || addedContracts <= 0) {
      toast.error("Enter a valid number of contracts.");
      return;
    }
    if (!Number.isFinite(addedContractPrice) || addedContractPrice <= 0) {
      toast.error("Enter a valid price per contract.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/trades/${tradeId}/add`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addedContracts, addedContractPrice }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Unable to add to trade");
      }
      onSuccess?.();
      setContracts("");
      setPrice({ formatted: "", raw: 0 });
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast.error(e.message);
      } else {
        toast.error("Failed to update trade.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="sm:col-span-1">
        <label className="text-sm block mb-1">Contracts to Add</label>
        <Input
          type="number"
          min={1}
          value={contracts}
          onChange={(e) => setContracts(e.target.value)}
          placeholder="e.g., 2"
        />
      </div>
      <div className="sm:col-span-1">
        <label className="text-sm block mb-1">Price per Contract</label>
        <CurrencyInput
          value={price}
          onChange={setPrice}
          placeholder="e.g., 0.85"
        />
      </div>
      <div className="sm:col-span-1 flex items-end">
        <Button onClick={submit} disabled={loading} className="w-full">
          {loading ? "Updating…" : "Add to Position"}
        </Button>
      </div>
    </div>
  );
}
