"use client";

import { useState, useMemo, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Plus, X, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TypeBadge } from "@/features/trades/components/TypeBadge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { WatchlistResponse, WatchlistPosition } from "@/app/api/watchlist/route";
import type { QuoteResult } from "@/app/api/quotes/route";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

function formatExpiry(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function MarketStateBadge({ state }: { state: string | null | undefined }) {
  if (!state || state === "REGULAR") return null;
  const label =
    state === "PRE" ? "Pre" :
    state === "POST" || state === "POSTPOST" ? "After Hours" :
    "Closed";
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-600 dark:text-amber-400">
      {label}
    </span>
  );
}

function PriceCell({ quote }: { quote: QuoteResult | undefined }) {
  if (!quote) return <td className="px-4 py-3 text-sm text-muted-foreground" colSpan={2}>—</td>;

  const price = quote.price;
  const change = quote.change;
  const pct = quote.changePct;
  const up = (change ?? 0) >= 0;

  return (
    <>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums">
            {price != null ? fmt(price) : "—"}
          </span>
          <MarketStateBadge state={quote.marketState} />
        </div>
      </td>
      <td className="px-4 py-3">
        {change != null && pct != null ? (
          <span className={cn("text-sm tabular-nums font-medium", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
            {up ? "+" : ""}{fmt(change)} ({up ? "+" : ""}{pct.toFixed(2)}%)
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
    </>
  );
}

function OTMBadge({ type, strike, price }: { type: string; strike: number; price: number | null }) {
  if (price == null) return <span className="text-muted-foreground">—</span>;

  const t = type.toLowerCase().replace(/[\s_-]/g, "");
  const isCSP = t === "cashsecuredput";
  const isCC = t === "coveredcall";

  if (!isCSP && !isCC) return null;

  const isOTM = isCSP ? price > strike : price < strike;
  const pct = isCSP
    ? ((price - strike) / price) * 100
    : ((strike - price) / strike) * 100;

  return (
    <span className={cn(
      "text-xs font-semibold px-1.5 py-0.5 rounded",
      isOTM
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-red-500/10 text-red-600 dark:text-red-400"
    )}>
      {Math.abs(pct).toFixed(1)}% {isOTM ? "OTM" : "ITM"}
    </span>
  );
}

function PositionsTable({
  positions,
  quotes,
}: {
  positions: WatchlistPosition[];
  quotes: Record<string, QuoteResult>;
}) {
  const rows: { pos: WatchlistPosition; kind: "trade" | "stock"; idx: number }[] = [];
  for (const pos of positions) {
    pos.trades.forEach((_, i) => rows.push({ pos, kind: "trade", idx: i }));
    pos.stockLots.forEach((_, i) => rows.push({ pos, kind: "stock", idx: i }));
  }

  if (rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Positions</h2>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Ticker</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Price</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Change</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Position</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">OTM / ITM</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Portfolio</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ pos, kind, idx }) => {
                const quote = quotes[pos.ticker];
                if (kind === "trade") {
                  const t = pos.trades[idx];
                  return (
                    <tr key={`${t.id}`} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-sm">{pos.ticker}</td>
                      <PriceCell quote={quote} />
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <TypeBadge type={t.type} />
                          <span className="text-xs text-muted-foreground">
                            ${t.strikePrice} · {formatExpiry(t.expirationDate)} · {t.contractsOpen}x
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <OTMBadge type={t.type} strike={t.strikePrice} price={quote?.price ?? null} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{t.portfolioName}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/portfolios/${t.portfolioId}/trades/${t.id}`}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  );
                } else {
                  const lot = pos.stockLots[idx];
                  return (
                    <tr key={`${lot.id}`} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-sm">{pos.ticker}</td>
                      <PriceCell quote={quote} />
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">Stock</span>
                          <span className="text-xs text-muted-foreground">
                            {lot.shares} shares · avg {fmt(lot.avgCost)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {quote?.price != null ? (
                          <span className={cn(
                            "text-xs font-semibold",
                            quote.price >= lot.avgCost ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {quote.price >= lot.avgCost ? "+" : ""}{fmt((quote.price - lot.avgCost) * lot.shares)}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{lot.portfolioName}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/portfolios/${lot.portfolioId}/stocks/${lot.id}`}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  );
                }
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ManualWatchlistTable({
  tickers,
  positionTickers,
  quotes,
  onRemove,
}: {
  tickers: string[];
  positionTickers: Set<string>;
  quotes: Record<string, QuoteResult>;
  onRemove: (ticker: string) => void;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Ticker</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Price</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Change</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {tickers.map((ticker) => {
              const quote = quotes[ticker];
              const alsoPosition = positionTickers.has(ticker);
              return (
                <tr key={ticker} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{ticker}</span>
                      {alsoPosition && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Position</span>
                      )}
                    </div>
                  </td>
                  <PriceCell quote={quote} />
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onRemove(ticker)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title={`Remove ${ticker}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WatchlistPageContent() {
  const { data: watchlist, mutate } = useSWR<WatchlistResponse>("/api/watchlist", fetcher);

  const allTickers = useMemo(() => {
    const set = new Set<string>();
    watchlist?.positions?.forEach((p) => set.add(p.ticker));
    watchlist?.manual?.forEach((t) => set.add(t));
    return [...set];
  }, [watchlist]);

  const tickerParam = allTickers.join(",");
  const { data: quotes = {}, mutate: refreshQuotes, isValidating } = useSWR<Record<string, QuoteResult>>(
    tickerParam ? `/api/quotes?tickers=${tickerParam}` : null,
    fetcher,
    { refreshInterval: 60_000, dedupingInterval: 30_000 },
  );

  const positionTickers = useMemo(
    () => new Set((watchlist?.positions ?? []).map((p) => p.ticker)),
    [watchlist]
  );

  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function addTicker() {
    const ticker = input.trim().toUpperCase();
    if (!ticker) return;
    if (watchlist?.manual?.includes(ticker)) {
      toast.error(`${ticker} is already in your watchlist`);
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setInput("");
      await mutate();
      inputRef.current?.focus();
    } catch (e) {
      toast.error((e as Error).message || "Failed to add ticker");
    } finally {
      setAdding(false);
    }
  }

  async function removeTicker(ticker: string) {
    await fetch(`/api/watchlist/${ticker}`, { method: "DELETE" });
    await mutate();
  }

  const hasPositions = (watchlist?.positions?.length ?? 0) > 0;
  const hasManual = (watchlist?.manual?.length ?? 0) > 0;

  return (
    <div className="py-6 px-4 sm:px-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Watchlist</h1>
            <button
              onClick={() => refreshQuotes()}
              className={cn(
                "text-muted-foreground hover:text-foreground transition-colors",
                isValidating && "animate-spin"
              )}
              title="Refresh quotes"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live prices for your open positions and tracked tickers. Updates every 60s.
          </p>
        </div>

        {/* Add ticker */}
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addTicker()}
            placeholder="Add ticker…"
            className="w-36 uppercase text-sm"
            maxLength={10}
          />
          <Button size="sm" onClick={addTicker} disabled={adding || !input.trim()} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Positions — auto-populated from open trades and stock lots */}
      {hasPositions && (
        <PositionsTable positions={watchlist!.positions} quotes={quotes} />
      )}

      {/* Manual watchlist */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">My Watchlist</h2>
        {!hasManual ? (
          <div className="rounded-xl border border-dashed bg-card/50 px-6 py-12 flex flex-col items-center gap-3 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No tickers added yet.</p>
            <p className="text-xs text-muted-foreground/60">Type a ticker above and press Enter to start tracking it.</p>
          </div>
        ) : (
          <ManualWatchlistTable
            tickers={watchlist!.manual}
            positionTickers={positionTickers}
            quotes={quotes}
            onRemove={removeTicker}
          />
        )}
      </section>

    </div>
  );
}
