// hooks/useTradeTable.tsx
import { createColumnHelper } from "@tanstack/react-table";
import { Trade } from "@/types";
import * as Tooltip from "@radix-ui/react-tooltip";

const columnHelper = createColumnHelper<Trade>();

export const useTradeTable = (
  data: Trade[],
  options?: { isClosed?: boolean },
) => {
  const columns = [
    columnHelper.accessor<"ticker", string>("ticker", {
      header: "Ticker",
      cell: (info) => <span className="font-bold">{info.getValue()}</span>,
    }),
    columnHelper.accessor<"strikePrice", number>("strikePrice", {
      header: "Strike",
      cell: (info) => `$${info.getValue().toFixed(2)}`,
    }),
    columnHelper.accessor<"type", string>("type", {
      header: "Type",
      cell: (info) =>
        info
          .getValue()
          .replace(/([A-Z])/g, " $1")
          .trim(), // prettify enum
    }),
    columnHelper.accessor<"expirationDate", string>("expirationDate", {
      header: "Expiration",
      cell: (info) =>
        new Date(info.getValue()).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    }),
    columnHelper.accessor<"contracts", number>("contracts", {
      header: "Contracts",
    }),
    columnHelper.accessor<"contractPrice", number>("contractPrice", {
      header: "Premium",
      cell: (info) => `$${info.getValue().toFixed(2)}`,
    }),
  ];

  if (options?.isClosed) {
    columns.push(
      columnHelper.accessor<"closedAt", string | null>("closedAt", {
        header: "Closed At",
        cell: (info) =>
          info.getValue()
            ? new Date(info.getValue()!).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "-",
      }),
      columnHelper.accessor<"premiumCaptured", number | null>(
        "premiumCaptured",
        {
          header: "Premium Captured",
          cell: (info) =>
            info.getValue() != null ? `$${info.getValue()!.toFixed(2)}` : "-",
        },
      ),
      columnHelper.accessor<"percentPL", number | null>("percentPL", {
        header: "% P/L",
        cell: (info) => {
          const value = info.getValue();
          const trade = info.row.original;

          if (value == null) return "-";

          const color =
            value > 0
              ? "text-green-700 bg-green-100"
              : value < 0
                ? "text-red-700 bg-red-100"
                : "text-gray-600 bg-gray-100";

          return (
            <Tooltip.Provider delayDuration={100}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium cursor-default ${color}`}
                  >
                    {value.toFixed(2)}%
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
          );
        },
      }),
    );
  }

  return { columns, data };
};
