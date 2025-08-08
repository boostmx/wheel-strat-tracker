import { ColumnDef } from "@tanstack/react-table";
import { Trade } from "@/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Formats enum-ish strings like "CashSecuredPut" -> "Cash Secured Put"
const formatType = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2");

export const makeOpenColumns = (
  portfolioId: string,
  onCloseClick?: (trade: Trade) => void,
): ColumnDef<Trade>[] => [
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
    accessorKey: "contracts",
    header: "Contracts",
    meta: { align: "right" },
  },
  {
    accessorKey: "expirationDate",
    header: "Expiration",
    cell: ({ getValue }) => {
      const v = getValue() as string | number | Date;
      const d = new Date(v);
      return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
    },
  },
  {
    accessorKey: "contractPrice",
    header: "Avg Price",
    cell: ({ getValue }) => {
      const n = Number(getValue());
      return isFinite(n) ? `$${n.toFixed(2)}` : "—";
    },
    meta: { align: "right" },
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => (
      <div className="space-x-2 flex items-center">
        <Button asChild variant="outline" size="sm">
          <Link href={`/portfolio/${portfolioId}/trade/${row.original.id}`}>
            View
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onCloseClick?.(row.original)}
        >
          Close
        </Button>
      </div>
    ),
  },
];
