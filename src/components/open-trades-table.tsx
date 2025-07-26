"use client";

import { Trade } from "@/types";
import { format } from "date-fns";
import { useState } from "react";
import { CloseTradeModal } from "@/components/close-trade-modal";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";

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
    ticker: string;
    type: string;
    expirationDate: string;
  } | null>(null);

  if (!trades || trades.length === 0) {
    return <p>No open trades yet.</p>;
  }

  function formatOptionType(type: string): string {
  return type
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}


  return (
    <>
      <table className="w-full text-sm text-left text-gray-700">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 not-italic">Ticker</th>
            <th className="px-4 py-2 not-italic">Strike</th>
            <th className="px-4 py-2 not-italic">Type</th>
            <th className="px-4 py-2 not-italic">Expiration</th>
            <th className="px-4 py-2 not-italic">Contracts</th>
            <th className="px-4 py-2 not-italic">Premium</th>
            <th className="px-4 py-2 not-italic">Action</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-t odd:bg-white even:bg-gray-50">
              <td className="px-4 py-2 font-semibold not-italic">{trade.ticker}</td>
              <td className="px-4 py-2 not-italic">${trade.strikePrice.toFixed(2)}</td>
              <td className="px-4 py-2 not-italic">{formatOptionType(trade.type)}</td>
              <td className="px-4 py-2 not-italic">
                {format(new Date(trade.expirationDate), "MMM d, yyyy")}
              </td>
              <td className="px-4 py-2 not-italic">{trade.contracts}</td>
              <td className="px-4 py-2 not-italic">${trade.contractPrice.toFixed(2)}</td>
              <td className="px-4 py-2 not-italic">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedTrade({
                      id: trade.id,
                      strikePrice: trade.strikePrice,
                      contracts: trade.contracts,
                      ticker: trade.ticker,
                      type: trade.type,
                      expirationDate: trade.expirationDate,
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
          ticker={selectedTrade.ticker}
          expirationDate={selectedTrade.expirationDate}
          type={selectedTrade.type}
        />
      )}
    </>
  );
}
