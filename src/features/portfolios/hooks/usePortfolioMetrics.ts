import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useOverviewMetrics(portfolioId?: string) {
  const key = portfolioId ? `/api/portfolios/${portfolioId}/metrics` : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    dedupingInterval: 10_000,
  });
  return { data, error, isLoading, mutate };
}
