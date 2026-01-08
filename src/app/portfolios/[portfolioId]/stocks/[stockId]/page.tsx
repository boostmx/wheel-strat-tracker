import StockDetailPageClient from "@/features/stocks/components/StockDetailPageClient";

export default async function Page(props: {
  params: Promise<{ id: string; stockId: string }>;
}) {
  const params = await props.params;
  const portfolioId = params.id;
  const stockId = params.stockId;

  return <StockDetailPageClient portfolioId={portfolioId} stockId={stockId} />;
}