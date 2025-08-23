import { ColumnDef } from "@tanstack/react-table";
import { Trade } from "@/types";
// Removed Link and Button imports (Action column removed)
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";

const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

// Formats enum-ish strings like "CashSecuredPut" -> "Cash Secured Put"
const formatType = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2");

const computePremiumCaptured = (t: Trade) => {
  // Prefer stored premiumCaptured if present
  if (typeof t.premiumCaptured === "number" && isFinite(t.premiumCaptured)) {
    return t.premiumCaptured;
  }

  // Determine the closed contracts count: prefer contractsInitial for closed rows, fallback to legacy contracts
  const closedContracts = (t as any).contractsInitial ?? (t as any).contracts ?? 0;

  // Derive from contract and closing price if available (per contract premium received - paid) * shares * contracts
  const perShare = (t.contractPrice ?? 0) - (t.closingPrice ?? 0);
  if (isFinite(perShare) && closedContracts > 0 && (t.contractPrice != null || t.closingPrice != null)) {
    return perShare * 100 * closedContracts;
  }

  // Fallback: total initial premium received
  return (t.contractPrice ?? 0) * 100 * closedContracts;
};

export const makeClosedColumns = (): ColumnDef<Trade>[] => [
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
    accessorKey: "closedAt",
    header: "Closed",
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
    id: "premiumCapturedDisplay",
    header: "Premium",
    cell: ({ row }) => {
      const v = computePremiumCaptured(row.original);
      const cls = v >= 0 ? "text-emerald-700" : "text-red-700";
      return <span className={cls}>{formatUSD(v)}</span>;
    },
    meta: { align: "right" },
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
];
