// components/open-trades-table.tsx
"use client";

import { Trade } from "@/types";
import { format } from "date-fns";

export function OpenTradesTable({ trades }: { trades: Trade[] }) {
  if (!trades || trades.length === 0) {
    return <p>No open trades yet.</p>;
  }

  return (
    <table className="w-full text-sm text-left text-gray-700">
      <thead className="bg-gray-100">
        <tr>
          <th className="px-4 py-2">Ticker</th>
          <th className="px-4 py-2">Strike</th>
          <th className="px-4 py-2">Type</th>
          <th className="px-4 py-2">Expiration</th>
          <th className="px-4 py-2">Contracts</th>
          <th className="px-4 py-2">Premium</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((trade) => (
          <tr key={trade.id} className="border-t">
            <td className="px-4 py-2 font-medium">{trade.ticker}</td>
            <td className="px-4 py-2">${trade.strikePrice.toFixed(2)}</td>
            <td className="px-4 py-2">{trade.type}</td>
            <td className="px-4 py-2">
              {format(new Date(trade.expirationDate), "MMM d, yyyy")}
            </td>
            <td className="px-4 py-2">{trade.contracts}</td>
            <td className="px-4 py-2">${trade.contractPrice.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
