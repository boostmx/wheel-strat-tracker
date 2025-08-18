"use client";

import { useOverviewMetrics } from "@/features/portfolios/hooks/usePortfolioMetrics";

function dollars(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "$0";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function OverviewMetrics({ portfolioId }: { portfolioId: string }) {
  const { data, isLoading } = useOverviewMetrics(portfolioId);

  const openTradesCount = isLoading ? "…" : (data?.openTradesCount ?? 0);
  const capitalUsed = isLoading ? "…" : (data?.capitalUsed ?? 0);
  const firstExp = (data?.nextExpirations ?? [])[0] as
    | { ticker: string; expirationDate: string; contracts: number }
    | undefined;
  const biggest = data?.biggestPosition as
    | { ticker: string; locked: number }
    | undefined;

  return (
    <div className="rounded-md bg-muted/40 border p-3">
      {/* Responsive grid: 2 cols on small, 4 cols on md+ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          label="Open Trades"
          value={openTradesCount}
        />

        <Metric
          label="Capital Used"
          value={
            typeof capitalUsed === "string"
              ? capitalUsed
              : dollars(capitalUsed as number)
          }
          tone="warning"
        />

        <Metric
          label="Next Expiration"
          value={firstExp ? firstExp.ticker : "—"}
          sub={
            firstExp
              ? `${new Date(firstExp.expirationDate).toLocaleDateString()} • ${firstExp.contracts} contract${firstExp.contracts === 1 ? "" : "s"}`
              : undefined
          }
          tone="info"
        />

        <Metric
          label="Biggest Position"
          value={biggest ? biggest.ticker : "—"}
          sub={biggest ? dollars(biggest.locked) : undefined}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "warning" | "danger" | "info" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "text-amber-700 dark:text-amber-300"
      : tone === "danger"
      ? "text-red-700 dark:text-red-400"
      : tone === "info"
      ? "text-blue-700 dark:text-blue-300"
      : tone === "success"
      ? "text-green-700 dark:text-green-300"
      : "text-foreground";

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${toneClass}`}>{value}</div>
      {sub ? (
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      ) : null}
    </div>
  );
}