import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useTrades(portfolioId: string, status: "open" | "closed") {
  const { data, error, isLoading, mutate } = useSWR(
    portfolioId
      ? `/api/trades?portfolioId=${portfolioId}&status=${status}`
      : null,
    fetcher,
  );

  return {
    trades: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}
