// components/open-trades-table.tsx
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
import Link from "next/link";
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
            <tr key={row.id} className="border-t">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
              <td className="px-4 py-2">
                <td className="px-4 py-2 space-x-2">
  <Link
    href={`/portfolio/${portfolioId}/trade/${row.original.id}`}
    className="text-blue-600 underline text-sm"
  >
    View
  </Link>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
          
      {selectedTrade && (
        <CloseTradeModal
          id={selectedTrade.id}
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
    </div>
  );
}
