"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { CreatePortfolioModal } from "@/components/create-portfolio-modal";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useEffect, useState } from "react";
import type { Portfolio } from "@/types";
import { formatDateOnlyUTC } from "@/lib/formatDateOnly";

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

  async function handleDelete(portfolioId: string) {
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }

      toast.success("Portfolio deleted");
      mutate("/api/portfolios");
    } catch (err) {
      toast.error("Failed to delete portfolio");
      console.error(err);
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-16 px-6 space-y-10">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Portfolios Overview</h1>
        <CreatePortfolioModal />
      </div>

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
          {portfolios.map((p) => {
            const snap = snapshots[p.id];
            const top = snap?.topTickers ?? [];
            const topLine = top
              .slice(0, 3)
              .map((t) => `${t.ticker} ${formatPercent(t.pct, 0)}`)
              .join(" · ");

            return (
              <Card
                key={p.id}
                className="relative hover:shadow-lg hover:-translate-y-1 transition duration-200"
              >
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-2 right-2 px-2 py-1 text-sm text-red-600 border border-red-500 rounded hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this portfolio and all its
                        trades.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => handleDelete(p.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Link href={`/portfolio/${p.id}`}>
                  <CardContent className="p-6 cursor-pointer">
                    <h2 className="text-xl font-semibold text-green-600">
                      {p.name || "Unnamed Portfolio"}
                    </h2>

                    {/* Row 1: Open Trades, Capital In Use, Cash Available */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                      <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Open Trades</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                          {snap ? snap.openCount : "-"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                        <p className="text-gray-600 dark:text-gray-400 font-medium">Capital In Use</p>
                        <p className="text-2xl font-semibold text-amber-700 dark:text-amber-300">
                          {snap ? formatCompactCurrency(snap.capitalInUse) : "-"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                        <p className="text-gray-600 dark:text-gray-400 font-medium">Cash Available</p>
                        <p className={`text-2xl font-semibold ${
                          snap && snap.cashAvailable < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-300"
                        }`}>
                          {snap ? formatCompactCurrency(snap.cashAvailable) : "-"}
                        </p>
                      </div>
                    </div>

                    {/* Row 2: Biggest Position, Next Expiration, Expiring Soon */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                      <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                        <p className="text-gray-600 dark:text-gray-400 font-medium">Biggest Position</p>
                        {snap?.biggest ? (
                          <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                            {snap.biggest.ticker} · ${snap.biggest.strikePrice.toFixed(2)} · {snap.biggest.contracts} contracts
                            <span className="block text-xs text-slate-600 dark:text-slate-400 mt-1">
                              Collateral: {formatCompactCurrency(snap.biggest.collateral)} · Exp {formatDateOnlyUTC(snap.biggest.expirationDate)}
                            </span>
                          </p>
                        ) : (
                          <p className="text-base text-slate-500 dark:text-slate-400">—</p>
                        )}
                      </div>

                      <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                        <p className="text-gray-600 dark:text-gray-400 font-medium">Next Expiration</p>
                        {snap?.nextExpiration ? (
                          <p className="text-base font-semibold text-blue-800 dark:text-blue-300">
                            {snap.nextExpiration ? `${formatDateOnlyUTC(snap.nextExpiration.date)} · ${snap.nextExpiration.contracts} contracts` : "—"}
                          </p>
                        ) : (
                          <p className="text-base text-blue-700 dark:text-blue-300">—</p>
                        )}
                      </div>

                      <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                        <p className="text-gray-600 dark:text-gray-400 font-medium">Expiring in 7 Days</p>
                        <p className="text-2xl font-semibold text-rose-700 dark:text-rose-300">
                          {snap ? snap.expiringSoonCount : "-"}
                        </p>
                      </div>
                    </div>

                    {/* Row 3: Top Exposures, Open Avg Days, MTD/YTD Realized */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                      <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Top Exposures</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {topLine || "—"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Open Avg Days</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {snap?.openAvgDays != null ? snap.openAvgDays : "—"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 text-sm">
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Realized P&L</p>
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          MTD {snap ? formatCompactCurrency(snap.realizedMTD) : <span className="dark:text-gray-500">—</span>}
                          <span className="mx-2 text-gray-400 dark:text-gray-500">•</span>
                          YTD {snap ? formatCompactCurrency(snap.realizedYTD) : <span className="dark:text-gray-500">—</span>}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}