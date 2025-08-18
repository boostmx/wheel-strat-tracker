"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { makeOpenColumns } from "./columns-open";
import { Trade } from "@/types";
import { CloseTradeModal } from "@/features/trades/components/CloseTradeModal";
import { mutate } from "swr";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";

// ---------- Helpers ----------
const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const isCashSecuredPut = (type?: string) =>
  !!type &&
  type.toLowerCase().includes("put") &&
  !type.toLowerCase().includes("covered");

const calcCapitalInUse = (t: Trade) =>
  isCashSecuredPut(t.type) ? t.strikePrice * 100 * t.contracts : 0;

const calcOpenPremium = (t: Trade) =>
  (t.contractPrice ?? 0) * 100 * t.contracts;

const calcBreakeven = (t: Trade) => {
  const premiumPerShare = t.contractPrice ?? 0;
  if (isCashSecuredPut(t.type)) {
    return t.strikePrice - premiumPerShare;
  }
  if (t.type?.toLowerCase().includes("covered")) {
    return t.entryPrice != null ? t.entryPrice - premiumPerShare : undefined;
  }
  return undefined;
};

const buildTooltipContent = (t: Trade) => (
  <div className="text-xs space-y-1">
    {isCashSecuredPut(t.type) && (
      <div>
        Capital in use:{" "}
        <span className="font-medium">{formatUSD(calcCapitalInUse(t))}</span>
      </div>
    )}
    <div>
      Open premium (total):{" "}
      <span className="font-medium">{formatUSD(calcOpenPremium(t))}</span>
    </div>
    {typeof t.entryPrice === "number" && isFinite(t.entryPrice) && (
      <div>
        Entry Price:{" "}
        <span className="font-medium">{formatUSD(t.entryPrice)}</span>
      </div>
    )}
    {typeof calcBreakeven(t) === "number" && (
      <div>
        Breakeven:{" "}
        <span className="font-medium">{formatUSD(calcBreakeven(t)!)}</span>
      </div>
    )}
    {t.createdAt && (
      <div>
        Opened on:{" "}
        <span className="font-medium">
          {formatDateOnlyUTC(new Date(t.createdAt))}
        </span>
      </div>
    )}
  </div>
);

const infoColumn: ColumnDef<Trade> = {
  id: "info",
  header: "",
  enableSorting: false,
  size: 28,
  minSize: 28,
  maxSize: 32,
  cell: ({ row }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1"
          aria-label="More info"
        >
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={10}
        collisionPadding={8}
        className="max-w-xs"
      >
        {buildTooltipContent(row.original)}
      </TooltipContent>
    </Tooltip>
  ),
};

// ---------- Component ----------
export function OpenTradesTable({
  trades,
  portfolioId,
}: {
  trades: Trade[];
  portfolioId: string;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedTrade, setSelectedTrade] = useState<{
    id: string;
    strikePrice: number;
    contracts: number;
  } | null>(null);

  const columns = useMemo(() => {
    const base = makeOpenColumns() as ColumnDef<Trade, unknown>[];
    return [infoColumn, ...base];
  }, []);

  const table = useReactTable({
    data: trades,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="w-full overflow-x-auto">
      <TooltipProvider delayDuration={150}>
        <table className="min-w-full text-sm text-left text-gray-700 dark:text-gray-100">
          <thead className="bg-gray-100 dark:bg-gray-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2 font-semibold cursor-pointer select-none dark:text-gray-200"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getAllColumns().length}
                  className="px-4 py-4 text-center text-gray-500 dark:text-gray-400"
                >
                  No trades currently open.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group border-t border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 cursor-pointer"
                  onClick={() =>
                    router.push(
                      `/portfolio/${portfolioId}/trade/${row.original.id}`,
                    )
                  }
                >
                  {row.getVisibleCells().map((cell, idx) => {
                    const isLast = idx === row.getVisibleCells().length - 1;
                    return (
                      <td
                        key={cell.id}
                        className={
                          isLast ? "relative px-4 py-2 pr-10" : "px-4 py-2"
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                        {isLast && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const t = row.original;
                                    setSelectedTrade({
                                      id: t.id,
                                      strikePrice: t.strikePrice,
                                      contracts: t.contracts,
                                    });
                                  }}
                                  className="text-gray-400 hover:text-emerald-600 dark:text-gray-500 dark:hover:text-emerald-400"
                                  aria-label="Close position"
                                >
                                  <XCircle className="h-5 w-5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="left"
                                align="center"
                                sideOffset={8}
                              >
                                Close position
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TooltipProvider>
      {selectedTrade && (
        <CloseTradeModal
          id={selectedTrade.id}
          portfolioId={portfolioId}
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
