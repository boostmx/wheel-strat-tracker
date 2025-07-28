import { Metrics } from "@/types";

export async function getPortfolioMetrics(portfolioId: string): Promise<Metrics> {
    const res = await fetch(`/api/portfolios/${portfolioId}/metrics`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch portfolio metrics");
  }

  return res.json();
}