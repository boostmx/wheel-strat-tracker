"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
} from "@tanstack/react-table";

import { Trade } from "@/types";
import { useTradeTable } from "@/hooks/useTradeTables";
import { CloseTradeModal } from "@/components/close-trade-modal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mutate } from "swr";

export function OpenTradesTable({
  trades,
  portfolioId,
}: {
  trades: Trade[];
  portfolioId: string;
}) {
  const [selectedTrade, setSelectedTrade] = useState<{
    id: string;
    strikePrice: number;
    contracts: number;
  } | null>(null);

  // State for row click modal
  const [selectedOpenTrade, setSelectedOpenTrade] = useState<Trade | null>(null);
  const [isOpenTradeModalOpen, setIsOpenTradeModalOpen] = useState(false);

  const handleRowClick = (trade: Trade) => {
    setSelectedOpenTrade(trade);
    setIsOpenTradeModalOpen(true);
  };

  const [sorting, setSorting] = useState<SortingState>([]);

  const { columns, data } = useTradeTable(trades);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!trades || trades.length === 0) {
    return <p>No open trades yet.</p>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full text-sm text-left text-gray-700">
        <thead className="bg-gray-100">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-2 font-semibold cursor-pointer select-none"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  {{
                    asc: " ↑",
                    desc: " ↓",
                  }[header.column.getIsSorted() as string] ?? null}
                </th>
              ))}
              <th className="px-4 py-2 font-semibold">Action</th>
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-t cursor-pointer hover:bg-blue-50"
              onClick={() => handleRowClick(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
              <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedTrade({
                      id: row.original.id,
                      strikePrice: row.original.strikePrice,
                      contracts: row.original.contracts,
                    })
                  }
                >
                  Close
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedTrade && (
        <CloseTradeModal
          tradeId={selectedTrade.id}
          strikePrice={selectedTrade.strikePrice}
          contracts={selectedTrade.contracts}
          isOpen={!!selectedTrade}
          onClose={() => setSelectedTrade(null)}
          refresh={() => {
            mutate(`/api/trades?portfolioId=${portfolioId}&status=open`);
            mutate(`/api/trades?portfolioId=${portfolioId}&status=closed`);
          }}
        />
      )}

      {selectedOpenTrade && (
        <TradeEditModal
          trade={selectedOpenTrade}
          open={isOpenTradeModalOpen}
          onOpenChange={setIsOpenTradeModalOpen}
          onSave={() => {
            mutate(`/api/trades?portfolioId=${portfolioId}&status=open`);
            mutate(`/api/trades?portfolioId=${portfolioId}&status=closed`);
          }}
        />
      )}
    </div>
  );
}

// --- TradeEditModal component ---
import { toast } from "sonner";

function TradeEditModal({
  trade,
  open,
  onOpenChange,
  onSave,
}: {
  trade: Trade;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    contracts: trade.contracts,
    strikePrice: trade.strikePrice,
    contractPrice: trade.contractPrice,
    entryPrice: trade.entryPrice ?? "",
    expirationDate: trade.expirationDate.split("T")[0], // yyyy-mm-dd
    createdAt: trade.createdAt,
    notes: trade.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  // Detect changes
  const isFormChanged =
    formData.entryPrice !== (trade.entryPrice ?? "") ||
    formData.expirationDate !== trade.expirationDate.split("T")[0] ||
    formData.notes !== (trade.notes ?? "") ||
    formData.createdAt !== trade.createdAt;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "contracts" || name === "strikePrice" || name === "contractPrice"
        ? Number(value)
        : value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only send editable fields plus notes
          entryPrice: formData.entryPrice === "" ? null : Number(formData.entryPrice),
          expirationDate: formData.expirationDate,
          notes: formData.notes,
        }),
      });
      if (!res.ok) throw new Error("Failed to update trade");
      toast.success("Trade updated!");
      onSave();
      onOpenChange(false);
    } catch (e) {
      toast.error("Error saving changes.");
      console.error("Trade update error:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {trade.ticker} — Trade Details
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 text-sm text-gray-700">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSave();
            }}
            className="flex flex-col gap-6"
          >
            <section className="flex flex-col gap-2">
              <h3 className="font-semibold text-gray-900 mb-2 text-base">Basic Info</h3>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
                <div className="text-sm font-semibold">{trade.type}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Contracts</label>
                <div className="text-sm">{formData.contracts}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Strike Price</label>
                <div className="text-sm">${formData.strikePrice.toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Contract Price</label>
                <div className="text-sm">${formData.contractPrice.toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Opened</label>
                <div className="text-sm">
                  {formData.createdAt
                    ? new Date(formData.createdAt).toLocaleDateString()
                    : "-"}
                </div>
              </div>
            </section>
            <section className="flex flex-col gap-2">
              <label className="block text-xs font-medium mb-1">Entry Price</label>
              <input
                type="number"
                name="entryPrice"
                className="w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.entryPrice}
                step="0.01"
                onChange={handleInputChange}
              />
            </section>
            <section className="flex flex-col gap-2">
              <label className="block text-xs font-medium mb-1">Expiration</label>
              <input
                type="date"
                name="expirationDate"
                className="w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.expirationDate}
                onChange={handleInputChange}
                required
              />
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="font-semibold text-gray-900 mb-1 text-base">Notes</h3>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={3}
                placeholder="Add notes about this trade..."
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
              />
            </section>
            <div className="border-t pt-4 flex justify-end gap-2">
              <Button
                variant="default"
                type="submit"
                disabled={saving || !isFormChanged}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}