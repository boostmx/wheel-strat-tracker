"use client";

import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
//import { toast } from "sonner";
import { CreatePortfolioModal } from "./CreatePortfolioModal";
import { Card, CardContent } from "@/components/ui/card";
import { OverviewMetrics } from "./OverviewMetrics";
import type { Portfolio } from "@/types";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

function dollars(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "$0";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v as unknown);
  return Number.isFinite(n) ? n : null;
}

function extractLatestNoteText(n?: string | null): string | null {
  if (!n) return null;
  const parts = n.split(/\n+/).map((s: string) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts[0];
}

function parseNoteLine(line: string): { timestamp?: string | undefined; body: string } {
  const m = line.match(/\*\*\[(.+?)\]\*\*/);
  const timestamp = m?.[1];
  const body = line.replace(/\s*\*\*\[.+?\]\*\*/, "").trim();
  return { timestamp, body };
}

export default function PortfoliosOverviewContent() {
  const { data: session } = useSession();

  const {
    data: portfolios = [],
    error,
    isLoading,
  } = useSWR<Portfolio[]>(session?.user?.id ? "/api/portfolios" : null);

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
            const starting = toNum(p.startingCapital);
            const additional = toNum(p.additionalCapital);
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
                      {/* Portfolio info row: capital + description/notes (lightweight, no extra fetch) */}
                      {((p.startingCapital != null) || (p.additionalCapital != null) || 
                      //p.description || 
                      p.notes) && (
                        <div className="mt-3 text-sm text-muted-foreground">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {starting !== null && (
                              <span><span className="font-medium text-foreground">Starting:</span> {dollars(starting)}</span>
                            )}
                            {additional !== null && (
                              <>
                                <span className="opacity-60">•</span>
                                <span><span className="font-medium text-foreground">Additional:</span> {dollars(additional)}</span>
                              </>
                            )}
                            
                            {/* Notes inline snippet removed */}
                            {/*p.description && (
                              <>
                                <span className="opacity-60">•</span>
                                <span className="truncate max-w-[32ch]" title={p.description}>
                                  <span className="font-medium text-foreground">Description:</span> {p.description}
                                </span>
                              </>
                            )*/}
                          </div>
                        </div>
                      )}
                      {p.notes && (() => {
                        const latestRaw = extractLatestNoteText(p.notes);
                        if (!latestRaw) return null;
                        const { timestamp, body } = parseNoteLine(latestRaw);
                        return (
                          <div className="mt-2">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs text-muted-foreground">Latest note</span>
                              {timestamp && (
                                <span className="text-xs text-muted-foreground">{timestamp}</span>
                              )}
                            </div>
                            <div
                              className="text-sm leading-relaxed whitespace-pre-wrap break-words line-clamp-3"
                              title={body}
                            >
                              {body || latestRaw}
                            </div>
                          </div>
                        );
                      })()}
                      <div className="mt-4">
                        <OverviewMetrics portfolioId={p.id} />
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
