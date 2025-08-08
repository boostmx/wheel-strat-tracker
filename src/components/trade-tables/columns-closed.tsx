import { ColumnDef } from "@tanstack/react-table";
import { Trade } from "@/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Formats enum-ish strings like "CashSecuredPut" -> "Cash Secured Put"
const formatType = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2");

export const makeClosedColumns = (portfolioId: string): ColumnDef<Trade>[] => [
  {
    accessorKey: "ticker",
    header: "Ticker",
    cell: ({ getValue }) => (
      <span className="font-medium">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ getValue }) => formatType(String(getValue())),
  },
  {
    accessorKey: "strikePrice",
    header: "Strike",
    cell: ({ getValue }) => {
      const n = Number(getValue());
      return isFinite(n) ? `$${n.toFixed(2)}` : "—";
    },
    meta: { align: "right" },
  },
  {
    accessorKey: "createdAt",
    header: "Opened",
    cell: ({ getValue }) => {
      const d = new Date(getValue() as string | number | Date);
      return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
    },
  },
  {
    accessorKey: "closedAt",
    header: "Closed",
    cell: ({ getValue }) => {
      const v = getValue();
      if (!v) return "—";
      const d = new Date(v as string | number | Date);
      return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
    },
  },
  {
    accessorKey: "percentPL",
    header: "P/L %",
    cell: ({ getValue }) => {
      const n = getValue() as number | null | undefined;
      if (n == null) return "—";
      const color =
        n > 0
          ? "text-green-700 bg-green-100"
          : n < 0
            ? "text-red-700 bg-red-100"
            : "text-gray-700 bg-gray-100";
      return (
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}
        >
          {n.toFixed(2)}%
        </span>
      );
    },
    meta: { align: "right" },
  },
  {
    id: "view",
    header: "Action",
    cell: ({ row }) => (
      <Button asChild variant="outline" size="sm">
        <Link href={`/portfolio/${portfolioId}/trade/${row.original.id}`}>
          View
        </Link>
      </Button>
    ),
  },
];
