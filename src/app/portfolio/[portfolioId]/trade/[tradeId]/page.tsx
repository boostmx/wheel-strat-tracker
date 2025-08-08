import ProtectedPage from "@/components/protected-page";
import TradeDetailPageClient from "@/components/trade-detail-page-client";

export default async function Page(props: {
  params: Promise<{ portfolioId: string; tradeId: string }>;
}) {
  const { portfolioId, tradeId } = await props.params;

  return (
    <ProtectedPage>
      <TradeDetailPageClient portfolioId={portfolioId} tradeId={tradeId} />
    </ProtectedPage>
  );
}
