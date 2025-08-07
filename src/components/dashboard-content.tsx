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

interface Metrics {
  winRate: number | null;
}

export default function DashboardContent() {
  const { data: session } = useSession();

  const {
    data: portfolios = [],
    error,
    isLoading,
  } = useSWR<Portfolio[]>(session?.user?.id ? "/api/portfolios" : null);

  const [metricsMap, setMetricsMap] = useState<Record<string, Metrics | null>>({});

  useEffect(() => {
    async function fetchAllMetrics() {
      if (!portfolios || portfolios.length === 0) return;

      const newMetricsMap: Record<string, Metrics | null> = {};

      await Promise.all(
        portfolios.map(async (p) => {
          try {
            const res = await fetch(`/api/portfolios/${p.id}/metrics`);
            if (res.ok) {
              const data = await res.json();
              newMetricsMap[p.id] = data;
            } else {
              newMetricsMap[p.id] = null;
            }
          } catch {
            newMetricsMap[p.id] = null;
          }
        })
      );

      setMetricsMap(newMetricsMap);
    }

    fetchAllMetrics();
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
        <h1 className="text-3xl font-bold text-gray-900">Your Portfolios</h1>
        <CreatePortfolioModal />
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading portfolios...</p>
      ) : error ? (
        <p className="text-red-500">Failed to load portfolios.</p>
      ) : portfolios.length === 0 ? (
        <div className="rounded-lg border border-gray-200 p-6 text-center shadow-sm bg-white">
          <p className="text-gray-600 mb-4 text-sm">
            You have not created any portfolios yet. Create one to get started!
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {portfolios.map((p) => {
            const metrics = metricsMap[p.id];

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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                      <div className="rounded-lg bg-gray-100 p-4 text-sm">
                        <p className="text-gray-500 font-medium">Starting Capital</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ${p.startingCapital.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-4 text-sm">
                        <p className="text-gray-500 font-medium">Current Capital</p>
                        <p className="text-lg font-semibold text-green-700">
                          ${p.currentCapital.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-4 text-sm">
                        <p className="text-gray-500 font-medium">Win Rate</p>
                        <p className="text-lg font-semibold text-blue-700">
                          {metrics?.winRate != null
                            ? `${(metrics.winRate * 100).toFixed(1)}%`
                            : "Loading..."}
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
