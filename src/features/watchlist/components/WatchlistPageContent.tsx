"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Reorder, useDragControls } from "framer-motion";
import { Plus, X, TrendingUp, RefreshCw, ArrowUpRight, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TypeBadge } from "@/features/trades/components/TypeBadge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { WatchlistResponse, WatchlistPosition } from "@/app/api/watchlist/route";
import type { QuoteResult } from "@/app/api/quotes/route";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

const fmtCompact = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

function fmtVolume(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function formatExpiry(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function MarketStateBadge({ state }: { state: string | null | undefined }) {
  if (!state || state === "REGULAR") return null;
  const label = state === "PRE" ? "Pre" : state === "POST" || state === "POSTPOST" ? "After Hours" : "Closed";
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-600 dark:text-amber-400 whitespace-nowrap">
      {label}
    </span>
  );
}

function RangeBar({ low, high, current }: { low: number | null; high: number | null; current: number | null }) {
  if (!current || !low || !high || low >= high) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const pct = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
  return (
    <div className="space-y-1 min-w-[110px]">
      <div className="relative h-1.5 w-full bg-muted rounded-full">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary border-2 border-background shadow-sm"
          style={{ left: `calc(${pct}% - 4px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{fmtCompact(low)}</span>
        <span>{fmtCompact(high)}</span>
      </div>
    </div>
  );
}

function QuoteSummary({ quote, align = "right" }: { quote: QuoteResult | undefined; align?: "left" | "right" }) {
  if (!quote?.price) return <span className="text-sm text-muted-foreground">—</span>;
  const up = (quote.change ?? 0) >= 0;
  return (
    <div className={cn("flex flex-col", align === "right" ? "items-end" : "items-start")}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold tabular-nums">{fmt(quote.price)}</span>
        <MarketStateBadge state={quote.marketState} />
      </div>
      {quote.change != null && quote.changePct != null && (
        <span className={cn("text-xs tabular-nums", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
          {up ? "+" : ""}{fmt(quote.change)} ({up ? "+" : ""}{quote.changePct.toFixed(2)}%)
        </span>
      )}
    </div>
  );
}

const TH = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th className={cn("px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider", className)}>
    {children}
  </th>
);

function PositionChip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border bg-background hover:bg-accent transition-colors text-xs group"
    >
      {children}
      <ArrowUpRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
    </Link>
  );
}

function positionChips(pos: WatchlistPosition, quote: QuoteResult | undefined, activeFilter: Set<string> | null) {
  const filteredTrades = activeFilter
    ? pos.trades.filter((t) => activeFilter.has(t.portfolioId))
    : pos.trades;
  const filteredLots = activeFilter
    ? pos.stockLots.filter((l) => activeFilter.has(l.portfolioId))
    : pos.stockLots;

  return (
    <div className="flex flex-wrap gap-1.5">
      {filteredTrades.map((t) => {
        const ty = t.type.toLowerCase().replace(/[\s_-]/g, "");
        const isCSP = ty === "cashsecuredput";
        const isCC = ty === "coveredcall";
        const otm = (() => {
          if (!quote?.price || (!isCSP && !isCC)) return null;
          const pct = isCSP
            ? ((quote.price - t.strikePrice) / quote.price) * 100
            : ((t.strikePrice - quote.price) / t.strikePrice) * 100;
          return { pct: Math.abs(pct), isOTM: pct > 0 };
        })();
        return (
          <PositionChip key={t.id} href={`/portfolios/${t.portfolioId}/trades/${t.id}`}>
            <TypeBadge type={t.type} />
            <span className="text-muted-foreground">
              ${t.strikePrice} · {formatExpiry(t.expirationDate)} · {t.contractsOpen}x
            </span>
            {otm && (
              <span className={cn("font-semibold", otm.isOTM ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {otm.pct.toFixed(1)}%{otm.isOTM ? " OTM" : " ITM"}
              </span>
            )}
            <span className="text-muted-foreground/50 border-l pl-1.5 ml-0.5">{t.portfolioName}</span>
          </PositionChip>
        );
      })}
      {filteredLots.map((lot) => {
        const unrealized = quote?.price != null ? (quote.price - lot.avgCost) * lot.shares : null;
        return (
          <PositionChip key={lot.id} href={`/portfolios/${lot.portfolioId}/stocks/${lot.id}`}>
            <span className="font-semibold text-muted-foreground">{lot.shares}sh</span>
            <span className="text-muted-foreground">@ {fmt(lot.avgCost)}</span>
            {unrealized != null && (
              <span className={cn("font-semibold", unrealized >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {unrealized >= 0 ? "+" : ""}{fmt(unrealized)}
              </span>
            )}
            <span className="text-muted-foreground/50 border-l pl-1.5 ml-0.5">{lot.portfolioName}</span>
          </PositionChip>
        );
      })}
    </div>
  );
}

function PositionsTable({
  positions,
  quotes,
}: {
  positions: WatchlistPosition[];
  quotes: Record<string, QuoteResult>;
}) {
  const [selectedPortfolios, setSelectedPortfolios] = useState<Set<string>>(new Set());

  const portfolioOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const pos of positions) {
      for (const t of pos.trades) map.set(t.portfolioId, t.portfolioName);
      for (const l of pos.stockLots) map.set(l.portfolioId, l.portfolioName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [positions]);

  const togglePortfolio = (id: string) => {
    setSelectedPortfolios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const activeFilter = selectedPortfolios.size > 0 ? selectedPortfolios : null;

  const filteredPositions = useMemo(() => {
    if (!activeFilter) return positions;
    return positions.filter(
      (pos) =>
        pos.trades.some((t) => activeFilter.has(t.portfolioId)) ||
        pos.stockLots.some((l) => activeFilter.has(l.portfolioId))
    );
  }, [positions, activeFilter]);

  if (positions.length === 0) return null;

  const unselectedOptions = portfolioOptions.filter((p) => !selectedPortfolios.has(p.id));

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Positions</h2>
        {portfolioOptions.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Active filter pills */}
            {[...selectedPortfolios].map((id) => {
              const name = portfolioOptions.find((p) => p.id === id)?.name ?? id;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                >
                  {name}
                  <button
                    onClick={() => togglePortfolio(id)}
                    className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                    title={`Remove ${name} filter`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
            {/* Add portfolio filter dropdown — only shown when unselected options remain */}
            {unselectedOptions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                    <Plus className="h-3 w-3" />
                    {selectedPortfolios.size === 0 ? "Filter portfolio" : "Add portfolio"}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[160px]">
                  {unselectedOptions.map((p) => (
                    <DropdownMenuItem key={p.id} onSelect={() => togglePortfolio(p.id)}>
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <TH className="w-20">Ticker</TH>
                <TH>Price</TH>
                <TH>Change</TH>
                <TH>Open Positions</TH>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPositions.map((pos) => {
                const quote = quotes[pos.ticker];
                const up = (quote?.change ?? 0) >= 0;
                return (
                  <tr key={pos.ticker} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-sm">{pos.ticker}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">{quote?.price != null ? fmt(quote.price) : "—"}</span>
                        <MarketStateBadge state={quote?.marketState} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {quote?.change != null && quote?.changePct != null ? (
                        <span className={cn("text-sm tabular-nums font-medium", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                          {up ? "+" : ""}{fmt(quote.change)} ({up ? "+" : ""}{quote.changePct.toFixed(2)}%)
                        </span>
                      ) : <span className="text-sm text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">{positionChips(pos, quote, activeFilter)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {filteredPositions.map((pos) => {
            const quote = quotes[pos.ticker];
            return (
              <div key={pos.ticker} className="px-4 py-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-base">{pos.ticker}</span>
                  <QuoteSummary quote={quote} align="right" />
                </div>
                {positionChips(pos, quote, activeFilter)}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

function DraggableWatchlistRow({
  ticker,
  positionTickers,
  quotes,
  onRemove,
}: {
  ticker: string;
  positionTickers: Set<string>;
  quotes: Record<string, QuoteResult>;
  onRemove: (ticker: string) => void;
}) {
  const controls = useDragControls();
  const quote = quotes[ticker];
  const up = (quote?.change ?? 0) >= 0;

  return (
    <Reorder.Item
      as="tr"
      value={ticker}
      dragListener={false}
      dragControls={controls}
      className="hover:bg-muted/40 transition-colors"
      style={{ position: "relative" }}
    >
      <td className="px-2 py-3 w-8">
        <button
          onPointerDown={(e) => controls.start(e)}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{ticker}</span>
          {positionTickers.has(ticker) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Position</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums">{quote?.price != null ? fmt(quote.price) : "—"}</span>
          <MarketStateBadge state={quote?.marketState} />
        </div>
      </td>
      <td className="px-4 py-3">
        {quote?.change != null && quote?.changePct != null ? (
          <span className={cn("text-sm tabular-nums font-medium", up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
            {up ? "+" : ""}{fmt(quote.change)} ({up ? "+" : ""}{quote.changePct.toFixed(2)}%)
          </span>
        ) : <span className="text-sm text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-3">
        <RangeBar low={quote?.fiftyTwoWeekLow ?? null} high={quote?.fiftyTwoWeekHigh ?? null} current={quote?.price ?? null} />
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
        {fmtVolume(quote?.volume)}
      </td>
      <td className="px-4 py-3">
        <button onClick={() => onRemove(ticker)} className="text-muted-foreground hover:text-destructive transition-colors" title={`Remove ${ticker}`}>
          <X className="h-3.5 w-3.5" />
        </button>
      </td>
    </Reorder.Item>
  );
}

function DraggableMobileRow({
  ticker,
  positionTickers,
  quotes,
  onRemove,
}: {
  ticker: string;
  positionTickers: Set<string>;
  quotes: Record<string, QuoteResult>;
  onRemove: (ticker: string) => void;
}) {
  const controls = useDragControls();
  const quote = quotes[ticker];

  return (
    <Reorder.Item
      as="div"
      value={ticker}
      dragListener={false}
      dragControls={controls}
      className="px-4 py-3 space-y-2.5 border-b last:border-b-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onPointerDown={(e) => controls.start(e)}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="font-semibold text-base">{ticker}</span>
          {positionTickers.has(ticker) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Position</span>
          )}
        </div>
        <div className="flex items-start gap-2">
          <QuoteSummary quote={quote} align="right" />
          <button onClick={() => onRemove(ticker)} className="text-muted-foreground hover:text-destructive transition-colors mt-0.5 flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">52W Range</p>
          <RangeBar low={quote?.fiftyTwoWeekLow ?? null} high={quote?.fiftyTwoWeekHigh ?? null} current={quote?.price ?? null} />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Volume</p>
          <p className="text-sm tabular-nums text-muted-foreground">{fmtVolume(quote?.volume)}</p>
        </div>
      </div>
    </Reorder.Item>
  );
}

function ManualWatchlistTable({
  tickers,
  positionTickers,
  quotes,
  onRemove,
  onReorder,
}: {
  tickers: string[];
  positionTickers: Set<string>;
  quotes: Record<string, QuoteResult>;
  onRemove: (ticker: string) => void;
  onReorder: (newOrder: string[]) => void;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <TH className="w-8" />
              <TH className="w-24">Ticker</TH>
              <TH>Price</TH>
              <TH>Change</TH>
              <TH>52W Range</TH>
              <TH>Volume</TH>
              <TH />
            </tr>
          </thead>
          <Reorder.Group as="tbody" axis="y" values={tickers} onReorder={onReorder} className="divide-y">
            {tickers.map((ticker) => (
              <DraggableWatchlistRow
                key={ticker}
                ticker={ticker}
                positionTickers={positionTickers}
                quotes={quotes}
                onRemove={onRemove}
              />
            ))}
          </Reorder.Group>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        <Reorder.Group as="div" axis="y" values={tickers} onReorder={onReorder}>
          {tickers.map((ticker) => (
            <DraggableMobileRow
              key={ticker}
              ticker={ticker}
              positionTickers={positionTickers}
              quotes={quotes}
              onRemove={onRemove}
            />
          ))}
        </Reorder.Group>
      </div>

    </div>
  );
}

export default function WatchlistPageContent() {
  const { data: watchlist, mutate } = useSWR<WatchlistResponse>("/api/watchlist", fetcher);

  const [localTickers, setLocalTickers] = useState<string[] | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tickers = localTickers ?? watchlist?.manual ?? [];

  // Sync local state when server data arrives (but not while a drag is pending)
  const prevManual = useRef<string[] | null>(null);
  if (watchlist?.manual && watchlist.manual !== prevManual.current) {
    prevManual.current = watchlist.manual;
    if (localTickers === null) {
      // no pending local reorder — nothing to do
    }
  }

  const allTickers = useMemo(() => {
    const set = new Set<string>();
    watchlist?.positions?.forEach((p) => set.add(p.ticker));
    tickers.forEach((t) => set.add(t));
    return [...set];
  }, [watchlist, tickers]);

  const tickerParam = allTickers.join(",");
  const { data: quotes = {}, mutate: refreshQuotes, isValidating } = useSWR<Record<string, QuoteResult>>(
    tickerParam ? `/api/quotes?tickers=${tickerParam}` : null,
    fetcher,
    { refreshInterval: 60_000, dedupingInterval: 30_000 },
  );

  const positionTickers = useMemo(
    () => new Set((watchlist?.positions ?? []).map((p) => p.ticker)),
    [watchlist],
  );

  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function addTicker() {
    const ticker = input.trim().toUpperCase();
    if (!ticker) return;

    if (tickers.includes(ticker)) {
      toast.error(`${ticker} is already in your watchlist`);
      return;
    }

    setAdding(true);
    try {
      const quoteRes = await fetch(`/api/quotes?tickers=${ticker}`);
      const quoteData: Record<string, QuoteResult> = await quoteRes.json();
      if (!quoteData[ticker] || quoteData[ticker].price === null) {
        toast.error(`"${ticker}" wasn't found or has no price data`);
        return;
      }

      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setInput("");
      setLocalTickers(null);
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
    setLocalTickers(null);
    await mutate();
  }

  const handleReorder = useCallback(
    (newOrder: string[]) => {
      setLocalTickers(newOrder);
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(async () => {
        try {
          await fetch("/api/watchlist", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tickers: newOrder }),
          });
          await mutate();
          setLocalTickers(null);
        } catch {
          toast.error("Failed to save order");
        }
      }, 600);
    },
    [mutate],
  );

  const hasPositions = (watchlist?.positions?.length ?? 0) > 0;
  const hasManual = tickers.length > 0;

  return (
    <div className="py-6 px-4 sm:px-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Watchlist</h1>
            <button
              onClick={() => refreshQuotes()}
              className={cn("text-muted-foreground hover:text-foreground transition-colors", isValidating && "animate-spin")}
              title="Refresh quotes"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live prices for your positions and tracked tickers. Updates every 60s.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && !adding && addTicker()}
            placeholder="Add ticker…"
            className="flex-1 sm:w-36 uppercase text-sm"
            maxLength={10}
            disabled={adding}
          />
          <Button size="sm" onClick={addTicker} disabled={adding || !input.trim()} className="gap-1.5 whitespace-nowrap">
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {adding ? "Checking…" : "Add"}
          </Button>
        </div>
      </div>

      {hasPositions && <PositionsTable positions={watchlist!.positions} quotes={quotes} />}

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
            tickers={tickers}
            positionTickers={positionTickers}
            quotes={quotes}
            onRemove={removeTicker}
            onReorder={handleReorder}
          />
        )}
      </section>

    </div>
  );
}
