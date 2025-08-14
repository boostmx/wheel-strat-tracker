import ProtectedPage from "@/components/protected-page";
import PortfoliosOverviewContent from "@/components/portfolios-overview-content";

export default function DashboardPage() {
  return (
    <ProtectedPage>
      <PortfoliosOverviewContent />
    </ProtectedPage>
  );
}
