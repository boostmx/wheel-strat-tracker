import ProtectedPage from "@/features/auth/components/ProtectedPage";
import TradeDetailPageClient from "@/features/trades/components/TradeDetailPageClient";

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
