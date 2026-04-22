"use client";
import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type { QuoteResult } from "@/app/api/quotes/route";
import { Trade } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, ChevronRight } from "lucide-react";
import type { Metrics } from "@/types";
import {
  TradeNotesSimple,
  type TradeNotesHandle,
} from "@/features/trades/components/TradeNotesSimple";
import CloseTradeModal from "@/features/trades/components/CloseTradeModal";
import AddToTradeModal from "@/features/trades/components/AddToTradeModal";
import { formatDateOnlyUTC, ensureUtcMidnight } from "@/lib/formatDateOnly";

type Props = { portfolioId: string; tradeId: string };

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

function formatType(type: string) {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatCloseReason(reason: string | null | undefined) {
  if (!reason) return null;
  if (reason === "expiredWorthless") return "Expired Worthless";
  if (reason === "assigned") return "Assigned";
  if (reason === "manual") return "Manual";
  return reason;
}

function TypeBadge({ type }: { type: string }) {
  const t = type.toLowerCase();
  const isCoveredCall =
    t === "coveredcall" || (t.includes("covered") && t.includes("call"));
  const isCSP = t.includes("put") && !t.includes("covered");
  const isCall = t.includes("call") && !isCoveredCall;

  const cls = isCoveredCall
    ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20"
    : isCSP
      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
      : isCall
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

  return (
    <Badge variant="secondary" className={`border ${cls}`}>
      {formatType(type)}
    </Badge>
  );
}

function StatusBadge({ status }: { status: "open" | "closed" }) {
  return (
    <Badge
      variant="secondary"
      className={
        status === "open"
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
          : "bg-muted text-muted-foreground border border-border/60"
      }
    >
      {status === "open" ? "Open" : "Closed"}
    </Badge>
  );
}

type Tone = "default" | "success" | "danger" | "warning";

function PrimaryStat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  const valueColor =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "text-rose-600 dark:text-rose-400"
        : tone === "warning"
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
      {sub ? (
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  const valueColor =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "text-rose-600 dark:text-rose-400"
        : tone === "warning"
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";

  return (
    <>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium tabular-nums ${valueColor}`}>
        {value}
      </div>
    </>
  );
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok)
      throw new Error(
        ((await r.json().catch(() => ({}))) as { error?: string }).error ||
          `Failed ${r.status}`,
      );
    return r.json();
  });

export default function TradeDetailPageClient({ portfolioId, tradeId }: Props) {
  const {
    data: trade,
    isLoading,
    mutate,
  } = useSWR<Trade>(`/api/trades/${tradeId}`, fetcher, {
    dedupingInterval: 10_000,
  });

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const notesRef = useRef<TradeNotesHandle>(null);

  const { data: quoteData } = useSWR<Record<string, QuoteResult>>(
    trade?.ticker ? `/api/quotes?tickers=${trade.ticker}` : null,
    fetcher,
    { refreshInterval: 60_000, dedupingInterval: 30_000 },
  );
  const quote = trade?.ticker ? quoteData?.[trade.ticker] : undefined;

  const { data: metrics } = useSWR<Metrics>(
    trade ? `/api/portfolios/${portfolioId}/metrics` : null,
    fetcher,
    { dedupingInterval: 60_000 },
  );

  const { data: portfolio } = useSWR<{ id: string; name: string | null }>(
    portfolioId ? `/api/portfolios/${portfolioId}` : null,
    fetcher,
    { dedupingInterval: 60_000 },
  );

  const daysUntilExpiration = useMemo(() => {
    if (!trade || trade.status !== "open") return null;
    const exp = ensureUtcMidnight(trade.expirationDate).getTime();
    const today = ensureUtcMidnight(new Date()).getTime();
    return Math.max(0, Math.ceil((exp - today) / 86_400_000));
  }, [trade]);

  const daysHeld = useMemo(() => {
    if (!trade || trade.status !== "closed" || !trade.closedAt) return null;
    const closed = ensureUtcMidnight(trade.closedAt).getTime();
    const opened = ensureUtcMidnight(trade.createdAt).getTime();
    return Math.max(0, Math.ceil((closed - opened) / 86_400_000));
  }, [trade]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-10 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!trade) {
    return <p className="text-rose-500 p-6">Trade not found.</p>;
  }

  const isOpen = trade.status === "open";
  const t = trade.type.toLowerCase();
  const isCashSecuredPut = t.includes("put") && !t.includes("covered");

  const contractsOpen = trade.contractsOpen ?? trade.contracts ?? 0;
  const contractsInitial = trade.contractsInitial ?? trade.contracts ?? 0;
  const contractsDisplay = isOpen ? contractsOpen : contractsInitial;
  const partiallyFilled = isOpen && contractsOpen !== contractsInitial;

  const openPremium = trade.contractPrice * 100 * contractsOpen;
  const capitalInUse = isOpen && isCashSecuredPut
    ? trade.strikePrice * 100 * contractsOpen
    : 0;

  const isCoveredCall = t.includes("covered");
  const totalCapital = metrics?.capitalBase ?? metrics?.startingCapital ?? 0;
  const allocPct = totalCapital > 0 && capitalInUse > 0
    ? (capitalInUse / totalCapital) * 100
    : null;
  const breakeven = isCashSecuredPut
    ? trade.strikePrice - trade.contractPrice
    : isCoveredCall && trade.entryPrice != null
      ? trade.entryPrice - trade.contractPrice
      : null;

  const dteTone: Tone =
    daysUntilExpiration == null
      ? "default"
      : daysUntilExpiration <= 7
        ? "danger"
        : daysUntilExpiration <= 21
          ? "warning"
          : "default";

  const premiumTone: Tone =
    trade.premiumCaptured == null
      ? "default"
      : trade.premiumCaptured > 0
        ? "success"
        : "danger";

  const closeReason = formatCloseReason(trade.closeReason);

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/portfolios" className="hover:text-foreground transition-colors">Portfolio Overview</Link>
          <ChevronRight className="h-3 w-3 opacity-50" />
          <Link href={`/portfolios/${portfolioId}`} className="hover:text-foreground transition-colors">
            {portfolio?.name ?? "Portfolio"}
          </Link>
          <ChevronRight className="h-3 w-3 opacity-50" />
          <span className="text-foreground">{trade?.ticker ?? "Trade"}</span>
        </div>
        {isOpen ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCloseModalOpen(true)}>
              Close Position
            </Button>
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              Add to Position
            </Button>
          </div>
        ) : null}
      </div>

      {/* Ticker + badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-semibold tracking-tight">{trade.ticker}</h1>
        <TypeBadge type={trade.type} />
        <StatusBadge status={trade.status} />
        {isOpen && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Position details"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs space-y-1">
                <div>
                  Open premium:{" "}
                  <span className="font-medium">{fmt(openPremium)}</span>
                </div>
                {capitalInUse > 0 && (
                  <div>
                    Capital in use:{" "}
                    <span className="font-medium">{fmt(capitalInUse)}</span>
                  </div>
                )}
                {allocPct != null && (
                  <div>
                    Portfolio allocation:{" "}
                    <span className="font-medium">{allocPct.toFixed(1)}%</span>
                  </div>
                )}
                {breakeven != null && (
                  <div>
                    Breakeven:{" "}
                    <span className="font-medium">{fmt(breakeven)}</span>
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Primary stat cards */}
      <div className={`grid gap-3 ${isOpen ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
        <PrimaryStat label="Strike" value={fmt(trade.strikePrice)} />
        <PrimaryStat
          label="Avg Price"
          value={fmt(trade.contractPrice)}
          sub={isOpen
            ? `${fmt(openPremium)} total`
            : `${fmt(trade.contractPrice * 100 * contractsInitial)} received`}
        />
        {isOpen ? (
          <PrimaryStat
            label="Capital In Use"
            value={capitalInUse > 0 ? fmt(capitalInUse) : "—"}
            sub={
              capitalInUse > 0 && allocPct != null
                ? `${allocPct.toFixed(1)}% of portfolio`
                : capitalInUse > 0
                  ? undefined
                  : "N/A for CCs"
            }
          />
        ) : (
          <PrimaryStat
            label="Close Price"
            value={trade.closingPrice != null ? fmt(trade.closingPrice) : "Expired"}
            sub={trade.closingPrice != null
              ? `${fmt(trade.closingPrice * 100 * contractsInitial)} paid`
              : "worthless"}
          />
        )}
        {isOpen ? (
          <PrimaryStat
            label={
              quote?.marketState && quote.marketState !== "REGULAR"
                ? quote.marketState === "PRE"
                  ? "Pre-Market"
                  : quote.marketState === "POST" || quote.marketState === "POSTPOST"
                    ? "After Hours"
                    : "Last Close"
                : "Live Price"
            }
            value={quote?.price != null ? fmt(quote.price) : "—"}
            sub={
              quote?.change != null && quote?.changePct != null
                ? `${quote.change >= 0 ? "+" : ""}${fmt(quote.change)} (${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%)`
                : undefined
            }
            tone={
              quote?.change == null
                ? "default"
                : quote.change > 0
                  ? "success"
                  : quote.change < 0
                    ? "danger"
                    : "default"
            }
          />
        ) : (
          <PrimaryStat
            label="Premium Captured"
            value={trade.premiumCaptured != null ? fmt(trade.premiumCaptured) : "—"}
            sub={
              trade.percentPL != null
                ? `${trade.percentPL >= 0 ? "+" : ""}${trade.percentPL.toFixed(1)}% P/L`
                : undefined
            }
            tone={premiumTone}
          />
        )}
      </div>

      {/* Secondary details card */}
      <Card className="p-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Details
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {isOpen ? (
            <>
              <DetailRow
                label="Contracts"
                value={
                  partiallyFilled
                    ? `${contractsOpen} open · ${contractsInitial} initial`
                    : String(contractsDisplay)
                }
              />
              <DetailRow
                label="Expiry"
                value={
                  daysUntilExpiration != null
                    ? `${formatDateOnlyUTC(trade.expirationDate)} · ${daysUntilExpiration === 0 ? "today" : `${daysUntilExpiration}d`}`
                    : formatDateOnlyUTC(trade.expirationDate)
                }
                tone={dteTone}
              />
              <DetailRow label="Opened" value={formatDateOnlyUTC(trade.createdAt)} />
              {trade.entryPrice != null ? (
                <DetailRow label="Stock Entry Price" value={fmt(trade.entryPrice)} />
              ) : null}
            </>
          ) : (
            <>
              <DetailRow label="Contracts" value={String(contractsDisplay)} />
              <DetailRow
                label="Expiry"
                value={formatDateOnlyUTC(trade.expirationDate)}
              />
              <DetailRow label="Opened" value={formatDateOnlyUTC(trade.createdAt)} />
              <DetailRow
                label="Closed"
                value={trade.closedAt ? formatDateOnlyUTC(trade.closedAt) : "—"}
              />
              <DetailRow
                label="Days Held"
                value={daysHeld != null ? `${daysHeld}d` : "—"}
              />
              {closeReason ? (
                <DetailRow label="Close Reason" value={closeReason} />
              ) : null}
              {trade.entryPrice != null ? (
                <DetailRow label="Stock Entry Price" value={fmt(trade.entryPrice)} />
              ) : null}
            </>
          )}
        </div>
      </Card>

      {/* Notes card */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Notes
          </div>
          {!notesEditing ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => notesRef.current?.startEditing()}
            >
              Edit
            </Button>
          ) : null}
        </div>
        <TradeNotesSimple
          ref={notesRef}
          tradeId={tradeId}
          initialNotes={trade.notes ?? ""}
          hideHeader
          onEditingChange={setNotesEditing}
        />
      </Card>

      {/* Modals */}
      {isOpen ? (
        <>
          <CloseTradeModal
            id={trade.id}
            portfolioId={portfolioId}
            isOpen={closeModalOpen}
            onClose={() => setCloseModalOpen(false)}
            strikePrice={trade.strikePrice}
            contracts={contractsOpen}
            ticker={trade.ticker}
            expirationDate={String(trade.expirationDate)}
            type={trade.type}
            refresh={() => mutate()}
          />
          <AddToTradeModal
            isOpen={addModalOpen}
            onClose={() => setAddModalOpen(false)}
            tradeId={trade.id}
            portfolioId={portfolioId}
            currentContracts={contractsOpen}
            avgContractPrice={trade.contractPrice}
            ticker={trade.ticker}
            onUpdated={() => mutate()}
          />
        </>
      ) : null}
    </div>
  );
}
