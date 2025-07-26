// components/closed-trades-table.tsx
"use client";

import { Trade } from "@/types";
import { format } from "date-fns";
import * as Tooltip from "@radix-ui/react-tooltip";

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
    <div className="w-full">
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
            <th className="px-3 py-2 not-italic text-left">% P/L</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr
              key={trade.id}
              className="border-t odd:bg-white even:bg-gray-50"
            >
              <td className="px-4 py-2 font-semibold not-italic">
                {trade.ticker}
              </td>
              <td className="px-4 py-2 not-italic">
                ${trade.strikePrice.toFixed(2)}
              </td>
              <td className="px-4 py-2 not-italic">
                {formatOptionType(trade.type)}
              </td>
              <td className="px-4 py-2 not-italic">
                {format(new Date(trade.expirationDate), "MMM d, yyyy")}
              </td>
              <td className="px-4 py-2 not-italic">{trade.contracts}</td>
              <td className="px-4 py-2 not-italic">
                ${trade.contractPrice.toFixed(2)}
              </td>
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
              <td className="px-3 py-2 not-italic">
                {trade.percentPL != null ? (
                  <Tooltip.Provider delayDuration={100}>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium cursor-default ${
                            trade.percentPL > 0
                              ? "text-green-700 bg-green-100"
                              : trade.percentPL < 0
                                ? "text-red-700 bg-red-100"
                                : "text-gray-600 bg-gray-100"
                          }`}
                        >
                          {trade.percentPL.toFixed(2)}%
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          side="top"
                          className="rounded bg-black text-white text-xs px-2 py-1 shadow-md"
                        >
                          Entry: ${trade.entryPrice?.toFixed(2) ?? "-"}
                          <br />
                          Close: ${trade.closingPrice?.toFixed(2) ?? "-"}
                          <br />
                          Captured: ${trade.premiumCaptured?.toFixed(2) ?? "-"}
                          <br />
                          Contracts: {trade.contracts}
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
