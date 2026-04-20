import { ColumnDef } from "@tanstack/react-table";
import { Trade } from "@/types";
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";
import { TypeBadge } from "@/features/trades/components/TypeBadge";

type TradeWithNewFields = Trade & { contractsOpen?: number | null };


const calcDTE = (expirationDate: string | Date): number => {
  const exp = new Date(expirationDate);
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expUTC = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate());
  return Math.max(0, Math.ceil((expUTC - todayUTC) / 86_400_000));
};

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
    cell: ({ getValue }) => <TypeBadge type={String(getValue())} />,
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
    accessorFn: (row) =>
      (row as TradeWithNewFields).contractsOpen ??
      (row as TradeWithNewFields).contracts ??
      0,
    cell: ({ row }) => {
      const t = row.original as TradeWithNewFields;
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
        return formatDateOnlyUTC(v as string | Date);
      } catch {
        return "—";
      }
    },
  },
  {
    id: "dte",
    header: "DTE",
    accessorFn: (row) => calcDTE(row.expirationDate),
    cell: ({ getValue }) => {
      const n = Number(getValue());
      const cls =
        n <= 7
          ? "text-rose-600 dark:text-rose-400 font-semibold"
          : n <= 21
            ? "text-amber-600 dark:text-amber-400"
            : "text-foreground";
      return <span className={cls}>{n}d</span>;
    },
    meta: { align: "right" },
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
