import { ColumnDef } from "@tanstack/react-table";
import { Trade } from "@/types";
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";

// Formats enum-ish strings like "CashSecuredPut" -> "Cash Secured Put"
const formatType = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2");

export const makeOpenColumns = (): ColumnDef<Trade>[] => [
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
    id: "contractsOpen",
    header: "Contracts",
    accessorFn: (row) => (row as any).contractsOpen ?? (row as any).contracts ?? 0,
    cell: ({ row }) => {
      const t = row.original as any;
      return t.contractsOpen ?? t.contracts ?? 0;
    },
    meta: { align: "right" },
  },
  {
    accessorKey: "expirationDate",
    header: "Expiration",
    cell: ({ getValue }) => {
      const v = getValue();
      if (!v) return "—";
      try {
        // Works for both "YYYY-MM-DD" strings and ISO timestamps
        return formatDateOnlyUTC(v as string | Date);
      } catch {
        return "—";
      }
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
];
