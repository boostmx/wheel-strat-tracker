import ProtectedPage from "@/features/auth/components/ProtectedPage";
import PortfoliosOverviewContent from "@/features/portfolios/components/PortfoliosOverviewContent";

export default function DashboardPage() {
  return (
    <ProtectedPage>
      <PortfoliosOverviewContent />
    </ProtectedPage>
  );
}
