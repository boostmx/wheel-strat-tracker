"use client";

import useSWR from "swr";
import type { StocksListResponse, StockLot } from "@/types";
import { useRouter } from "next/navigation";

type Props = {
  portfolioId: string;
};

function toNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const fetcher = async (url: string): Promise<StocksListResponse> => {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as StocksListResponse;
};

export function StocksTable({ portfolioId }: Props) {
  const router = useRouter();
  const key = `/api/stocks?portfolioId=${encodeURIComponent(portfolioId)}&status=open`;
  const { data, error, isLoading } = useSWR<StocksListResponse>(key, fetcher);

  const rows: StockLot[] = data?.stockLots ?? [];

  return (
    <div className="overflow-hidden">
      {isLoading ? (
        <div className="px-4 py-4 text-sm text-muted-foreground">Loading stocks…</div>
      ) : error ? (
        <div className="px-4 py-4 text-sm text-destructive">Failed to load stocks.</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-4 text-sm text-muted-foreground">
          No stock positions yet. Add one to start tracking assigned shares.
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-full text-sm text-left text-foreground">
            <thead className="border-b border-border/60">
              <tr>
                <th className="px-2 sm:px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide select-none">Ticker</th>
                <th className="px-2 sm:px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide select-none">Shares</th>
                <th className="px-2 sm:px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide select-none">Avg Cost</th>
                <th className="px-2 sm:px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide select-none">Cost Basis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const avg = toNumber(r.avgCost);
                const basis = avg * r.shares;

                return (
                  <tr
                    key={r.id}
                    className="group border-b border-border/40 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => router.push(`/portfolios/${portfolioId}/stocks/${r.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/portfolios/${portfolioId}/stocks/${r.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <td className="px-2 sm:px-4 py-2 font-semibold tracking-wide">{r.ticker}</td>
                    <td className="px-2 sm:px-4 py-2">{r.shares}</td>
                    <td className="px-2 sm:px-4 py-2">{formatCurrency(avg)}</td>
                    <td className="px-2 sm:px-4 py-2">{formatCurrency(basis)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}