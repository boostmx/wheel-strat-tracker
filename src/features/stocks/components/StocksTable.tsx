"use client";

import useSWR from "swr";
import type { StocksListResponse, StockLot } from "@/types";
import { Card } from "@/components/ui/card";
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
    <Card className="mt-4 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading stocks…</div>
        ) : error ? (
          <div className="text-sm text-destructive">Failed to load stocks.</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No stock positions yet. Add one to start tracking assigned shares.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="py-3 px-3 text-left font-medium">Ticker</th>
                  <th className="py-3 px-3 text-left font-medium">Shares</th>
                  <th className="py-3 px-3 text-left font-medium">Avg Cost</th>
                  <th className="py-3 px-3 text-left font-medium">Cost Basis</th>
                  <th className="py-3 px-3 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const avg = toNumber(r.avgCost);
                  const basis = avg * r.shares;

                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border/40 hover:bg-muted/30 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/portfolios/${portfolioId}/stocks/${r.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/portfolios/${portfolioId}/stocks/${r.id}`);
                        }
                      }}
                    >
                      <td className="py-3 px-3 font-medium tracking-wide">{r.ticker}</td>
                      <td className="py-3 px-3">{r.shares}</td>
                      <td className="py-3 px-3">{formatCurrency(avg)}</td>
                      <td className="py-3 px-3">{formatCurrency(basis)}</td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {r.notes ? (
                          <span className="line-clamp-1">{r.notes}</span>
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}