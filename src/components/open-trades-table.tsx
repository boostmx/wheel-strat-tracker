import { Trade } from "@/types";
import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
} from "@tanstack/react-table";
import {
  calculateAdjustedContracts,
  calculateAverageContractPrice,
} from "@/lib/trade-metrics";
import { useTradeTable } from "@/hooks/useTradeTables";
import { CloseTradeModal } from "@/components/close-trade-modal";
import { TradeEditModal } from "@/components/trade-edit-modal";
import { AddToTradeModal } from "@/components/add-to-trade-modal";
import { Button } from "@/components/ui/button";
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

  const [selectedOpenTrade, setSelectedOpenTrade] = useState<Trade | null>(
    null,
  );
  const [isOpenTradeModalOpen, setIsOpenTradeModalOpen] = useState(false);
  const [addToTradeModalOpen, setAddToTradeModalOpen] = useState(false);

  const handleRowClick = (trade: Trade) => {
    setSelectedOpenTrade(trade);
    setIsOpenTradeModalOpen(true);
  };

  const handleAddToPosition = (trade: Trade) => {
    setSelectedOpenTrade(trade);
    setAddToTradeModalOpen(true);
  };

  const [sorting, setSorting] = useState<SortingState>([]);

  const enrichedTrades = useMemo(() => {
    return trades.map((trade) => {
      const totalContracts = calculateAdjustedContracts(trade);
      const avgPrice = calculateAverageContractPrice(trade);
      return { ...trade, totalContracts, avgPrice };
    });
  }, [trades]);

  const { columns, data } = useTradeTable(enrichedTrades);

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
                <div className="flex gap-2">
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddToPosition(row.original)}
                  >
                    Add
                  </Button>
                </div>
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

      {selectedOpenTrade && (
        <AddToTradeModal
          tradeId={selectedOpenTrade.id}
          open={addToTradeModalOpen}
          onOpenChange={setAddToTradeModalOpen}
          onSave={() => {
            mutate(`/api/trades?portfolioId=${portfolioId}&status=open`);
          }}
        />
      )}
    </div>
  );
}
