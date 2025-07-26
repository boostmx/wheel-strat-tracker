// components/closed-trades-table.tsx
"use client";

import { Trade } from "@/types";
import { format } from "date-fns";

export function ClosedTradesTable({ trades }: { trades: Trade[] }) {
  if (!trades || trades.length === 0) {
    return <p>No closed trades yet.</p>;
  }

  function formatOptionType(type: string): string {
  return type
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

  return (
    <table className="w-full text-sm text-left text-gray-700">
      <thead className="bg-gray-100">
        <tr>
          <th className="px-4 py-2 not-italic">Ticker</th>
          <th className="px-4 py-2 not-italic">Strike</th>
          <th className="px-4 py-2 not-italic">Type</th>
          <th className="px-4 py-2 not-italic">Expiration</th>
          <th className="px-4 py-2 not-italic">Contracts</th>
          <th className="px-4 py-2 not-italic">Premium</th>
          <th className="px-4 py-2 not-italic">Closed At</th>
          <th className="px-4 py-2 not-italic">Premium Captured</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((trade) => (
          <tr key={trade.id} className="border-t odd:bg-white even:bg-gray-50">
            <td className="px-4 py-2 font-semibold">{trade.ticker}</td>
            <td className="px-4 py-2 not-italic">${trade.strikePrice.toFixed(2)}</td>
            <td className="px-4 py-2 not-italic">{formatOptionType(trade.type)}</td>
            <td className="px-4 py-2 not-italic">
              {format(new Date(trade.expirationDate), "MMM d, yyyy")}
            </td>
            <td className="px-4 py-2 not-italic">{trade.contracts}</td>
            <td className="px-4 py-2 not-italic">${trade.contractPrice.toFixed(2)}</td>
            <td className="px-4 py-2 not-italic">
              {trade.closedAt
                ? format(new Date(trade.closedAt), "MMM d, yyyy")
                : "-"}
            </td>
            <td className="px-4 py-2 not-italic">
              {trade.premiumCaptured != null
                ? `$${trade.premiumCaptured.toFixed(2)}`
                : "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
