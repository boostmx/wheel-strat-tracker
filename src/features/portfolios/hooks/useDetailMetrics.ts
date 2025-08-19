import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Failed: ${r.status}`);
    return r.json();
  });

export function useDetailMetrics(portfolioId?: string) {
  const key = portfolioId
    ? `/api/portfolios/${portfolioId}/detail-metrics`
    : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    dedupingInterval: 10_000,
  });
  return { data, error, isLoading, mutate };
}
