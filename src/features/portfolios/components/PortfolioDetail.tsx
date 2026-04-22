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

import { Portfolio } from "@/types";
import { useTrades } from "@/features/trades/hooks/useTrades";
import { useDetailMetrics } from "@/features/portfolios/hooks/useDetailMetrics";
import { motion } from "framer-motion";
import { useState } from "react";
import { Settings, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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

function SectionHeader({
  label,
  count,
  action,
}: {
  label: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
          {label}
        </span>
        {count != null && (
          <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full leading-none">
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

export function PortfolioDetail({ portfolio }: { portfolio: Portfolio }) {
  const { trades: openTrades, isLoading: loadingOpen } = useTrades(
    portfolio.id,
    "open",
  );
  const { trades: closedTrades, isLoading: loadingClosed } = useTrades(
    portfolio.id,
    "closed",
  );
  const { data: m } = useDetailMetrics(portfolio.id);

  const [addStockOpen, setAddStockOpen] = useState(false);

  const starting = Number(portfolio.startingCapital ?? 0);
  const addl = Number(portfolio.additionalCapital ?? 0);
  const base = starting + addl;

  const currentCapital =
    m?.currentCapital != null
      ? Number(m.currentCapital)
      : base + Number(m?.totalProfit ?? 0);

  const cashAvailable =
    m?.cashAvailable != null ? Number(m.cashAvailable) : null;
  const capitalUsed = m?.capitalUsed != null ? Number(m.capitalUsed) : null;
  const pctDeployed =
    m?.percentCapitalDeployed != null
      ? Number(m.percentCapitalDeployed)
      : null;
  const totalProfit = m?.totalProfit != null ? Number(m.totalProfit) : null;
  const realizedMTD = m?.realizedMTD != null ? Number(m.realizedMTD) : null;
  const realizedYTD = m?.realizedYTD != null ? Number(m.realizedYTD) : null;
  const potentialPremium =
    m?.potentialPremium != null ? Number(m.potentialPremium) : null;
  const avgPLPercent =
    m?.avgPLPercent != null ? Number(m.avgPLPercent) : null;
  const winRate = m?.winRate != null ? Number(m.winRate) : null;
  const avgDaysInTrade =
    m?.avgDaysInTrade != null ? Number(m.avgDaysInTrade) : null;

  const profitPos = totalProfit != null && totalProfit >= 0;
  const cashNeg = cashAvailable != null && cashAvailable < 0;
  const barColor =
    pctDeployed == null
      ? "bg-emerald-500"
      : pctDeployed >= 85
        ? "bg-red-500"
        : pctDeployed >= 60
          ? "bg-amber-500"
          : "bg-emerald-500";

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-5">

      {/* ── Header ── */}
      <motion.div
        className="flex items-start justify-between gap-3"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        style={{ willChange: "opacity, transform" }}
      >
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Link href="/portfolios" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Portfolio Overview
            </Link>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">{portfolio.name || "Unnamed Portfolio"}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            {portfolio.name || "Unnamed Portfolio"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Base capital {dollars(base)}
          </p>
        </div>
        <Link href={`/portfolios/${portfolio.id}/settings`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 mt-0.5"
            title="Portfolio settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
      </motion.div>

      {/* ── KPI Strip ── */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.05 }}
        style={{ willChange: "opacity, transform" }}
      >
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Current Capital
          </p>
          <p className="mt-1 text-xl font-bold text-foreground tabular-nums">
            {dollars(currentCapital)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {totalProfit != null
              ? `${profitPos ? "+" : ""}${compact(totalProfit)} profit`
              : ""}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Cash Available
          </p>
          <p
            className={`mt-1 text-xl font-bold tabular-nums ${
              cashNeg
                ? "text-red-500 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {cashAvailable != null ? dollars(cashAvailable) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {capitalUsed != null ? `${compact(capitalUsed)} in use` : ""}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Deployed
          </p>
          <p
            className={`mt-1 text-xl font-bold tabular-nums ${
              pctDeployed == null
                ? "text-foreground"
                : pctDeployed >= 85
                  ? "text-red-500"
                  : pctDeployed >= 60
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
            }`}
          >
            {pctDeployed != null ? `${pctDeployed.toFixed(1)}%` : "—"}
          </p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
            {pctDeployed != null && (
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${Math.min(pctDeployed, 100)}%` }}
              />
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Total P&L
          </p>
          <p
            className={`mt-1 text-xl font-bold tabular-nums ${
              profitPos
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400"
            }`}
          >
            {totalProfit != null
              ? `${profitPos ? "+" : ""}${compact(totalProfit)}`
              : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {realizedMTD != null
              ? `MTD ${realizedMTD >= 0 ? "+" : ""}${compact(realizedMTD)}`
              : ""}
          </p>
        </div>
      </motion.div>

      {/* ── Performance strip ── */}
      {(potentialPremium != null || winRate != null || avgPLPercent != null || avgDaysInTrade != null || realizedYTD != null || realizedMTD != null) && (
        <motion.div
          className="rounded-xl border bg-card shadow-sm px-4 py-3 flex flex-wrap gap-x-6 gap-y-3"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.08 }}
          style={{ willChange: "opacity, transform" }}
        >
          {potentialPremium != null && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Open Premium</p>
              <p className="text-sm font-bold text-teal-600 dark:text-teal-400 tabular-nums">{compact(potentialPremium)}</p>
            </div>
          )}
          {winRate != null && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Win Rate</p>
              <p className={`text-sm font-bold tabular-nums ${winRate >= 0.5 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                {(winRate * 100).toFixed(0)}%
              </p>
            </div>
          )}
          {avgPLPercent != null && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Avg P/L</p>
              <p className={`text-sm font-bold tabular-nums ${avgPLPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                {avgPLPercent >= 0 ? "+" : ""}{avgPLPercent.toFixed(1)}%
              </p>
            </div>
          )}
          {avgDaysInTrade != null && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Avg Days</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{avgDaysInTrade.toFixed(0)}</p>
            </div>
          )}
          {realizedYTD != null && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">YTD Realized</p>
              <p className={`text-sm font-bold tabular-nums ${realizedYTD >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                {realizedYTD >= 0 ? "+" : ""}{compact(realizedYTD)}
              </p>
            </div>
          )}
          {realizedMTD != null && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">MTD Realized</p>
              <p className={`text-sm font-bold tabular-nums ${realizedMTD >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                {realizedMTD >= 0 ? "+" : ""}{compact(realizedMTD)}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Stock Lots ── */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.1 }}
        style={{ willChange: "opacity, transform" }}
      >
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Stock Lots
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setAddStockOpen(true)}
            >
              <Plus className="h-3 w-3" />
              Add Stock
            </Button>
          </div>
          <StocksTable portfolioId={portfolio.id} />
        </div>
        <AddStockModal
          portfolioId={portfolio.id}
          open={addStockOpen}
          onOpenChange={setAddStockOpen}
        />
      </motion.div>

      {/* ── Open Positions ── */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.11 }}
        style={{ willChange: "opacity, transform" }}
      >
        <SectionHeader
          label="Open Positions"
          count={openTrades.length}
          action={<AddTradeModal portfolioId={portfolio.id} />}
        />
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {loadingOpen ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Loading positions…
            </div>
          ) : openTrades.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No open option positions yet.
              </p>
              <AddTradeModal portfolioId={portfolio.id} />
            </div>
          ) : (
            <OpenTradesTable
              trades={openTrades}
              portfolioId={portfolio.id}
              totalCapital={currentCapital}
            />
          )}
        </div>
      </motion.div>

      {/* ── Closed Trades ── */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.14 }}
        style={{ willChange: "opacity, transform" }}
      >
        <SectionHeader
          label="Closed Trades"
          count={closedTrades.length}
        />
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {loadingClosed ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Loading closed trades…
            </div>
          ) : closedTrades.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No closed trades yet.
            </div>
          ) : (
            <ClosedTradesTable
              trades={closedTrades}
              portfolioId={portfolio.id}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}
