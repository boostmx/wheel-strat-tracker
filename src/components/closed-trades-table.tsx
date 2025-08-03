// components/closed-trades-table.tsx
"use client";

import { useState } from "react";
import { Trade } from "@/types";
import { useTradeTable } from "@/hooks/useTradeTables";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
} from "@tanstack/react-table";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ClosedTradesTable({ trades }: { trades: Trade[] }) {
  const { columns, data } = useTradeTable(trades, { isClosed: true });

  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleRowClick = (trade: Trade) => {
    setSelectedTrade(trade);
    setIsModalOpen(true);
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  });

  if (!trades || trades.length === 0) {
    return <p>No closed trades yet.</p>;
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
                  className="px-4 py-2 not-italic cursor-pointer select-none"
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
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, i) => (
            <tr
              key={row.id}
              onClick={() => handleRowClick(row.original)}
              className={`border-t cursor-pointer hover:bg-blue-50 ${
                i % 2 === 0 ? "bg-white" : "bg-gray-50"
              }`}
            >
              {row.getVisibleCells().map((cell) => {
                const isPL = cell.column.id === "percentPL";
                const raw = cell.getValue();

                return (
                  <td key={cell.id} className="px-4 py-2 not-italic">
                    {isPL && typeof raw === "number" ? (
                      <Tooltip.Provider delayDuration={100}>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium cursor-default ${
                                raw > 0
                                  ? "text-green-700 bg-green-100"
                                  : raw < 0
                                    ? "text-red-700 bg-red-100"
                                    : "text-gray-600 bg-gray-100"
                              }`}
                            >
                              {raw.toFixed(2)}%
                            </span>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content
                              side="top"
                              className="rounded bg-black text-white text-xs px-2 py-1 shadow-md"
                            >
                              Entry: $
                              {cell.row.original.entryPrice?.toFixed(2) ?? "-"}
                              <br />
                              Close: $
                              {cell.row.original.closingPrice?.toFixed(2) ??
                                "-"}
                              <br />
                              Captured: $
                              {cell.row.original.premiumCaptured?.toFixed(2) ??
                                "-"}
                              <br />
                              Contracts: {cell.row.original.contracts}
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                    ) : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {selectedTrade && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedTrade.ticker} — Trade Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <strong>Type:</strong> {selectedTrade.type}
              </p>
              <p>
                <strong>Strike Price:</strong> ${selectedTrade.strikePrice}
              </p>
              <p>
                <strong>Contracts:</strong> {selectedTrade.contracts}
              </p>
              <p>
                <strong>Opened:</strong>{" "}
                {selectedTrade.createdAt
                  ? new Date(selectedTrade.createdAt).toLocaleDateString()
                  : "-"}
              </p>
              <p>
                <strong>Closed:</strong>{" "}
                {selectedTrade.closedAt
                  ? new Date(selectedTrade.closedAt).toLocaleDateString()
                  : "-"}
              </p>
              <p>
                <strong>Entry Price:</strong> $
                {selectedTrade.entryPrice?.toFixed(2) ?? "-"}
              </p>
              <p>
                <strong>Closing Price:</strong> $
                {selectedTrade.closingPrice?.toFixed(2) ?? "-"}
              </p>
              <p>
                <strong>Premium Captured:</strong> $
                {selectedTrade.premiumCaptured?.toFixed(2) ?? "-"}
              </p>
              <p>
                <strong>% P/L:</strong>{" "}
                {selectedTrade.percentPL?.toFixed(2) ?? "-"}%
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
