"use client";

import { AddTradeModal } from "@/features/trades/components/AddTradeModal";
import { OpenTradesTable } from "@/features/trades/components/TradeTables/OpenTradesTable";
import { StocksTable } from "@/features/stocks/components/StocksTable";
import { AddStockModal } from "@/features/stocks/components/AddStockModal";
import dynamic from "next/dynamic";
const ClosedTradesTable = dynamic(
  () =>
    import("@/features/trades/components/TradeTables/ClosedTradesTable").then(
      (m) => m.ClosedTradesTable,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
    ),
  },
);
const AccountSummaryContent = dynamic(
  () => import("@/features/summary/components/AccountSummaryContent"),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
    ),
  },
);

const AccountsReportContent = dynamic(
  () =>
    import("@/features/reports/components/AccountReportsContent").then(
      (m) => m.AccountsReportContent,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground py-8 text-center">Loading report…</p>
    ),
  },
);

import { Portfolio } from "@/types";
import { useTrades } from "@/features/trades/hooks/useTrades";
import { useDetailMetrics } from "@/features/portfolios/hooks/useDetailMetrics";
import { PortfolioSettings } from "@/features/portfolios/components/PortfolioSettings";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { motion } from "framer-motion";
import { useState } from "react";
import { Settings, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

function dollars(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function compact(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

const TABS = ["Overview", "Positions", "Activity", "Report"] as const;
type Tab = (typeof TABS)[number];

export function PortfolioDetail({ portfolio }: { portfolio: Portfolio }) {
  const { trades: openTrades, isLoading: loadingOpen } = useTrades(portfolio.id, "open");
  const { trades: closedTrades, isLoading: loadingClosed } = useTrades(portfolio.id, "closed");
  const { data: m } = useDetailMetrics(portfolio.id);

  const storageKey = `portfolio-tab-${portfolio.id}`;
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "Overview";
    const saved = sessionStorage.getItem(storageKey);
    return TABS.includes(saved as Tab) ? (saved as Tab) : "Overview";
  });

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    sessionStorage.setItem(storageKey, tab);
  }

  const [addStockOpen, setAddStockOpen] = useState(false);

  const starting = Number(portfolio.startingCapital ?? 0);
  const capitalBase = m?.capitalBase != null ? Number(m.capitalBase) : starting;
  const currentCapital =
    m?.currentCapital != null ? Number(m.currentCapital) : capitalBase + Number(m?.totalProfit ?? 0);
  const potentialPremium = m?.potentialPremium != null ? Number(m.potentialPremium) : null;

  return (
    <div className="py-6 px-4 sm:px-6 space-y-5">

      {/* ── Header — always visible ── */}
      <motion.div
        className="flex items-start justify-between gap-3"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        style={{ willChange: "opacity, transform" }}
      >
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Link href="/summary" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              All Accounts
            </Link>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">{portfolio.name || "Unnamed Portfolio"}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            {portfolio.name || "Unnamed Portfolio"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Base capital {dollars(capitalBase)}
          </p>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5 shrink-0" title="Portfolio settings">
              <Settings className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent className="flex flex-col overflow-hidden w-full sm:max-w-[480px]">
            <SheetHeader className="pb-2 shrink-0">
              <SheetTitle>Portfolio Settings</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <PortfolioSettings portfolio={portfolio} />
            </div>
          </SheetContent>
        </Sheet>

      </motion.div>

      {/* ── Pill tab switcher ── */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => switchTab(tab)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap",
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
            {tab === "Positions" && openTrades.length > 0 && (
              <span className="text-[10px] font-semibold bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">
                {openTrades.length}
              </span>
            )}
            {tab === "Activity" && closedTrades.length > 0 && (
              <span className="text-[10px] font-semibold bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">
                {closedTrades.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content panel ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">

        {activeTab === "Overview" && (
          <div className="p-5 sm:p-6">
            <AccountSummaryContent portfolioId={portfolio.id} embedded />
          </div>
        )}

        {activeTab === "Positions" && (
          <div className="p-5 sm:p-6 space-y-5">
            {potentialPremium != null && (
              <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-6">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Open Premium</p>
                  <p className="text-sm font-bold text-teal-600 dark:text-teal-400 tabular-nums">{compact(potentialPremium)}</p>
                </div>
                {openTrades.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    across <span className="font-medium text-foreground">{openTrades.length}</span> open position{openTrades.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-2.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Stock Lots</span>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setAddStockOpen(true)}>
                  <Plus className="h-3 w-3" />
                  Add Stock
                </Button>
              </div>
              <StocksTable portfolioId={portfolio.id} />
            </div>
            <AddStockModal portfolioId={portfolio.id} open={addStockOpen} onOpenChange={setAddStockOpen} />

            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Open Positions</span>
                  {openTrades.length > 0 && (
                    <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full leading-none">
                      {openTrades.length}
                    </span>
                  )}
                </div>
                <AddTradeModal portfolioId={portfolio.id} />
              </div>
              <div className="rounded-xl border bg-card overflow-hidden">
                {loadingOpen ? (
                  <div className="p-10 text-center text-sm text-muted-foreground">Loading positions…</div>
                ) : openTrades.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 p-12 text-center">
                    <p className="text-sm text-muted-foreground">No open option positions yet.</p>
                    <AddTradeModal portfolioId={portfolio.id} />
                  </div>
                ) : (
                  <OpenTradesTable trades={openTrades} portfolioId={portfolio.id} totalCapital={currentCapital} />
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Activity" && (
          <div className="bg-card overflow-hidden">
            {loadingClosed ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Loading activity…</div>
            ) : closedTrades.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No closed trades yet.</div>
            ) : (
              <ClosedTradesTable trades={closedTrades} portfolioId={portfolio.id} />
            )}
          </div>
        )}

        {activeTab === "Report" && (
          <div className="p-5 sm:p-6">
            <AccountsReportContent defaultPortfolioId={portfolio.id} embedded />
          </div>
        )}

      </div>
    </div>
  );
}
