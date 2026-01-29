import ProtectedPage from "@/features/auth/components/ProtectedPage";
import StockDetailPageClient from "@/features/stocks/components/StockDetailPageClient";

export default async function Page(props: {
  params: Promise<{ portfolioId: string; stockId: string }>;
}) {
  const params = await props.params;
  const portfolioId = params.portfolioId;
  const stockId = params.stockId;

  return (
    <ProtectedPage>
      <StockDetailPageClient portfolioId={portfolioId} stockId={stockId} />;    
    </ProtectedPage>
  
  )
}