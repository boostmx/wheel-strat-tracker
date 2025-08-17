"use client";

import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
//import { toast } from "sonner";
import { CreatePortfolioModal } from "@/components/create-portfolio-modal";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import type { Portfolio } from "@/types";
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

// --- Snapshot types (returned by /api/portfolios/snapshot/bulk) ---
export type Snapshot = {
  openCount: number;
  capitalInUse: number;
  cashAvailable: number;
  biggest?: {
    ticker: string;
    strikePrice: number;
    contracts: number;
    collateral: number;
    expirationDate: string;
  } | null;
  topTickers: { ticker: string; collateral: number; pct: number }[];
  nextExpiration?: { date: string; contracts: number } | null;
  expiringSoonCount: number;
  openAvgDays: number | null;
  realizedMTD: number;
  realizedYTD: number;
} | null;

// Currency formatting utility (compact)
function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

export default function PortfoliosOverviewContent() {
  const { data: session } = useSession();

  const {
    data: portfolios = [],
    error,
    isLoading,
  } = useSWR<Portfolio[]>(session?.user?.id ? "/api/portfolios" : null);

  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});

  useEffect(() => {
    async function fetchSnapshots() {
      if (!portfolios || portfolios.length === 0) return;
      const ids = portfolios.map((p) => p.id);
      try {
        const res = await fetch("/api/portfolios/snapshot/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        const data: Record<string, Snapshot> = res.ok ? await res.json() : {};
        setSnapshots(data);
      } catch (e) {
        console.error("Failed to fetch snapshots", e);
      }
    }
    fetchSnapshots();
  }, [portfolios]);

  return (
    <div className="max-w-5xl mx-auto py-16 px-6 space-y-10">
      <motion.div
        className="flex justify-between items-center"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{ willChange: "opacity, transform" }}
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Portfolios Overview
        </h1>
        <CreatePortfolioModal />
      </motion.div>

      {isLoading ? (
        <p className="text-gray-500">Loading portfolios...</p>
      ) : error ? (
        <p className="text-red-500">Failed to load portfolios.</p>
      ) : portfolios.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-6 text-center shadow-sm bg-white dark:bg-gray-900">
          <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
            You have not created any portfolios yet. Create one to get started!
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {portfolios.map((p, i) => {
            const snap = snapshots[p.id];
            const top = snap?.topTickers ?? [];
            const topLine = top
              .slice(0, 3)
              .map((t) => `${t.ticker} ${formatPercent(t.pct, 0)}`)
              .join(" · ");

            return (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.06 + i * 0.04 }}
                whileHover={{ y: -2 }}
                style={{ willChange: "opacity, transform" }}
              >
                <Card className="relative hover:shadow-lg transition duration-200">
                  <Link
                    href={`/portfolio/${p.id}/settings`}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2"
                    aria-label="Edit portfolio settings"
                    title="Edit Portfolio"
                  >
                    <Button variant="ghost" size="icon">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>

                  <Link href={`/portfolio/${p.id}`}>
                    <CardContent className="p-6 cursor-pointer">
                      <h2 className="text-xl font-semibold text-green-600">
                        {p.name || "Unnamed Portfolio"}
                      </h2>

                      {/* Row 1: Open Trades, Capital In Use, Cash Available */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                          <p className="text-gray-500 dark:text-gray-400 font-medium">
                            Open Trades
                          </p>
                          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                            {snap ? snap.openCount : "-"}
                          </p>
                        </div>

                        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                          <p className="text-gray-600 dark:text-gray-400 font-medium">
                            Capital In Use
                          </p>
                          <p className="text-2xl font-semibold text-amber-700 dark:text-amber-300">
                            {snap
                              ? formatCompactCurrency(snap.capitalInUse)
                              : "-"}
                          </p>
                        </div>

                        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                          <p className="text-gray-600 dark:text-gray-400 font-medium">
                            Cash Available
                          </p>
                          <p
                            className={`text-2xl font-semibold ${
                              snap && snap.cashAvailable < 0
                                ? "text-red-700 dark:text-red-400"
                                : "text-green-700 dark:text-green-300"
                            }`}
                          >
                            {snap
                              ? formatCompactCurrency(snap.cashAvailable)
                              : "-"}
                          </p>
                        </div>
                      </div>

                      {/* Row 2: Biggest Position, Next Expiration, Expiring Soon */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                          <p className="text-gray-600 dark:text-gray-400 font-medium">
                            Biggest Position
                          </p>
                          {snap?.biggest ? (
                            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                              {snap.biggest.ticker} · $
                              {snap.biggest.strikePrice.toFixed(2)} ·{" "}
                              {snap.biggest.contracts} contracts
                              <span className="block text-xs text-slate-600 dark:text-slate-400 mt-1">
                                Collateral:{" "}
                                {formatCompactCurrency(snap.biggest.collateral)}{" "}
                                · Exp{" "}
                                {formatDateOnlyUTC(snap.biggest.expirationDate)}
                              </span>
                            </p>
                          ) : (
                            <p className="text-base text-slate-500 dark:text-slate-400">
                              —
                            </p>
                          )}
                        </div>

                        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                          <p className="text-gray-600 dark:text-gray-400 font-medium">
                            Next Expiration
                          </p>
                          {snap?.nextExpiration ? (
                            <p className="text-base font-semibold text-blue-800 dark:text-blue-300">
                              {snap.nextExpiration
                                ? `${formatDateOnlyUTC(snap.nextExpiration.date)} · ${snap.nextExpiration.contracts} contracts`
                                : "—"}
                            </p>
                          ) : (
                            <p className="text-base text-blue-700 dark:text-blue-300">
                              —
                            </p>
                          )}
                        </div>

                        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                          <p className="text-gray-600 dark:text-gray-400 font-medium">
                            Expiring in 7 Days
                          </p>
                          <p className="text-2xl font-semibold text-rose-700 dark:text-rose-300">
                            {snap ? snap.expiringSoonCount : "-"}
                          </p>
                        </div>
                      </div>

                      {/* Row 3: Top Exposures, Open Avg Days, MTD/YTD Realized */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                          <p className="text-gray-500 dark:text-gray-400 font-medium">
                            Top Exposures
                          </p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {topLine || "—"}
                          </p>
                        </div>

                        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                          <p className="text-gray-500 dark:text-gray-400 font-medium">
                            Open Avg Days
                          </p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            {snap?.openAvgDays != null ? snap.openAvgDays : "—"}
                          </p>
                        </div>

                        <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                          <p className="text-gray-500 dark:text-gray-400 font-medium">
                            Realized P&L
                          </p>
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            MTD{" "}
                            {snap ? (
                              formatCompactCurrency(snap.realizedMTD)
                            ) : (
                              <span className="dark:text-gray-500">—</span>
                            )}
                            <span className="mx-2 text-gray-400 dark:text-gray-500">
                              •
                            </span>
                            YTD{" "}
                            {snap ? (
                              formatCompactCurrency(snap.realizedYTD)
                            ) : (
                              <span className="dark:text-gray-500">—</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
