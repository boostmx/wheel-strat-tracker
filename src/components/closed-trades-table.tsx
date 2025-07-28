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

export function ClosedTradesTable({ trades }: { trades: Trade[] }) {
  const { columns, data } = useTradeTable(trades, { isClosed: true });

  const [sorting, setSorting] = useState<SortingState>([]);

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
              className={
                i % 2 === 0 ? "bg-white border-t" : "bg-gray-50 border-t"
              }
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
    </div>
  );
}
