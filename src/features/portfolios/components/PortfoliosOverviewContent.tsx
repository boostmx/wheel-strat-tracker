"use client";

import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { CreatePortfolioModal } from "./CreatePortfolioModal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { useOverviewMetrics } from "@/features/portfolios/hooks/usePortfolioMetrics";
import type { Portfolio } from "@/types";

function dollars(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "$0";
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

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v as unknown);
  return Number.isFinite(n) ? n : null;
}

function extractLatestNoteText(n?: string | null): string | null {
  if (!n) return null;
  const parts = n
    .split(/\n+/)
    .map((s: string) => s.trim())
    .filter(Boolean);
  return parts[0] ?? null;
}

function parseNoteLine(line: string): { timestamp?: string; body: string } {
  const m = line.match(/\*\*\[(.+?)\]\*\*/);
  const timestamp = m?.[1];
  const body = line.replace(/\s*\*\*\[.+?\]\*\*/, "").trim();
  return { timestamp, body };
}

type StatChipProps = {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "danger" | "warning" | "info";
  isLoading?: boolean;
};

function StatChip({ label, value, tone = "default", isLoading }: StatChipProps) {
  const valueClass =
    tone === "success"
      ? "text-green-600 dark:text-green-400"
      : tone === "danger"
        ? "text-red-600 dark:text-red-400"
        : tone === "warning"
          ? "text-amber-600 dark:text-amber-400"
          : tone === "info"
            ? "text-primary"
            : "text-foreground";

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] text-muted-foreground leading-none mb-1">{label}</p>
      <p className={`text-sm font-semibold leading-none ${valueClass}`}>
        {isLoading ? <span className="opacity-40">—</span> : value}
      </p>
    </div>
  );
}

function PortfolioCard({ portfolio, index }: { portfolio: Portfolio; index: number }) {
  const { data: m, isLoading } = useOverviewMetrics(portfolio.id);

  const currentCapital = toNum(m?.currentCapital);
  const totalProfit = toNum(m?.totalProfit);
  const cashAvailable = toNum(m?.cashAvailable);
  const pctDeployed = toNum(m?.percentCapitalDeployed);
  const realizedMTD = toNum(m?.realizedMTD);
  const openTradesCount = m?.openTradesCount ?? null;
  const winRate = toNum(m?.winRate);
  const nextExp = (m?.nextExpirations ?? [])[0] as
    | { ticker: string; expirationDate: string; contracts: number; strikePrice?: number | null; type?: string | null }
    | undefined;

  const profitPositive = totalProfit != null && totalProfit >= 0;
  const cashNegative = cashAvailable != null && cashAvailable < 0;
  const mtdPositive = realizedMTD != null && realizedMTD >= 0;
  const highlyDeployed = pctDeployed != null && pctDeployed >= 85;

  const barColor =
    pctDeployed == null
      ? "bg-muted"
      : pctDeployed >= 85
        ? "bg-red-500"
        : pctDeployed >= 60
          ? "bg-amber-500"
          : "bg-green-500";

  return (
    <motion.li
      key={portfolio.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.06 + index * 0.04 }}
      whileHover={{ y: -2 }}
      style={{ willChange: "opacity, transform" }}
    >
      <Card className="relative hover:shadow-lg transition-shadow duration-200 overflow-hidden">
        {/* Settings button */}
        <Link
          href={`/portfolios/${portfolio.id}/settings`}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 right-3 z-10"
          aria-label="Edit portfolio settings"
          title="Edit Portfolio"
        >
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </Link>

        <Link href={`/portfolios/${portfolio.id}`}>
          <CardContent className="p-6 cursor-pointer">

            {/* ── Header: name + current capital + P&L ── */}
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-green-600 truncate">
                  {portfolio.name || "Unnamed Portfolio"}
                </h2>
                {currentCapital != null ? (
                  <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">
                    {dollars(currentCapital)}
                  </p>
                ) : (
                  <p className="text-2xl font-bold text-foreground mt-0.5 opacity-30">
                    {dollars(toNum(portfolio.startingCapital))}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Base: {dollars(toNum(portfolio.startingCapital))}
                  {toNum(portfolio.additionalCapital) ? ` + ${dollars(toNum(portfolio.additionalCapital))}` : ""}
                </p>
              </div>

              {/* P&L badge */}
              {totalProfit != null && (
                <div
                  className={`flex-shrink-0 flex flex-col items-end gap-0.5 rounded-lg px-3 py-2 ${
                    profitPositive
                      ? "bg-green-50 dark:bg-green-950/40"
                      : "bg-red-50 dark:bg-red-950/40"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {profitPositive ? (
                      <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span className="text-[11px] text-muted-foreground font-medium">Total P&L</span>
                  </div>
                  <span
                    className={`text-base font-bold tabular-nums ${
                      profitPositive ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
                    }`}
                  >
                    {profitPositive ? "+" : ""}
                    {compact(totalProfit)}
                  </span>
                  {realizedMTD != null && (
                    <span
                      className={`text-[10px] ${
                        mtdPositive ? "text-green-500 dark:text-green-500" : "text-red-400"
                      }`}
                    >
                      MTD {mtdPositive ? "+" : ""}{compact(realizedMTD)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ── Capital deployment bar ── */}
            {pctDeployed != null && (
              <div className="mt-4">
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>Capital Deployed</span>
                  <span className={`font-medium ${highlyDeployed ? "text-red-500" : "text-foreground"}`}>
                    {pctDeployed.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.min(pctDeployed, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* ── 4-stat grid ── */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatChip
                label="Cash Available"
                value={cashAvailable != null ? dollars(cashAvailable) : "—"}
                tone={isLoading ? "default" : cashNegative ? "danger" : "success"}
                isLoading={isLoading}
              />
              <StatChip
                label="Open Trades"
                value={openTradesCount ?? "—"}
                isLoading={isLoading}
              />
              <StatChip
                label="Win Rate"
                value={winRate != null ? `${(winRate * 100).toFixed(0)}%` : "—"}
                tone={isLoading ? "default" : winRate != null && winRate >= 0.5 ? "success" : "warning"}
                isLoading={isLoading}
              />
              <StatChip
                label="Realized MTD"
                value={realizedMTD != null ? compact(realizedMTD) : "—"}
                tone={isLoading ? "default" : mtdPositive ? "success" : "danger"}
                isLoading={isLoading}
              />
            </div>

            {/* ── Next expiration row ── */}
            {nextExp && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>Next exp:</span>
                <span className="font-medium text-foreground">{nextExp.ticker}</span>
                {nextExp.strikePrice != null && (
                  <span className="text-muted-foreground">${nextExp.strikePrice}</span>
                )}
                <span className="opacity-50">•</span>
                <span>{new Date(nextExp.expirationDate).toLocaleDateString()}</span>
                <span className="opacity-50">•</span>
                <span>
                  {nextExp.contracts} contract{nextExp.contracts !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* ── Latest note ── */}
            {portfolio.notes &&
              (() => {
                const latestRaw = extractLatestNoteText(portfolio.notes);
                if (!latestRaw) return null;
                const { timestamp, body } = parseNoteLine(latestRaw);
                return (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-[11px] text-muted-foreground">Latest note</span>
                      {timestamp && (
                        <span className="text-[11px] text-muted-foreground">{timestamp}</span>
                      )}
                    </div>
                    <p
                      className="text-xs leading-relaxed text-muted-foreground line-clamp-2"
                      title={body}
                    >
                      {body || latestRaw}
                    </p>
                  </div>
                );
              })()}
          </CardContent>
        </Link>
      </Card>
    </motion.li>
  );
}

export default function PortfoliosOverviewContent() {
  const { data: session } = useSession();

  const {
    data: portfolios = [],
    error,
    isLoading,
  } = useSWR<Portfolio[]>(session?.user?.id ? "/api/portfolios" : null);

  return (
    <div className="max-w-5xl mx-auto py-16 px-6 space-y-8">
      <motion.div
        className="flex justify-between items-center"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{ willChange: "opacity, transform" }}
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">Portfolios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading
              ? "Loading…"
              : portfolios.length === 0
                ? "No portfolios yet"
                : `${portfolios.length} portfolio${portfolios.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <CreatePortfolioModal />
      </motion.div>

      {error ? (
        <p className="text-red-500 text-sm">Failed to load portfolios.</p>
      ) : isLoading ? (
        <ul className="space-y-4">
          {[0, 1].map((i) => (
            <li key={i} className="rounded-xl border bg-card h-48 animate-pulse opacity-50" />
          ))}
        </ul>
      ) : portfolios.length === 0 ? (
        <div className="rounded-xl border p-8 text-center bg-card shadow-sm">
          <p className="text-muted-foreground text-sm">
            You haven&apos;t created any portfolios yet. Create one to get started!
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {portfolios.map((p, i) => (
            <PortfolioCard key={p.id} portfolio={p} index={i} />
          ))}
        </ul>
      )}
    </div>
  );
}
