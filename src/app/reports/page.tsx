import ProtectedPage from "@/features/auth/components/ProtectedPage";
import ReportsPanel from "@/features/reports/components/ReportsPanel";

export default function ReportsPage() {
  // TODO: replace with how you actually resolve the active portfolioId
  //const portfolioId = "YOUR_PORTFOLIO_ID_FROM_CONTEXT_OR_SEARCHPARAM";

  return (
    <ProtectedPage>
      <ReportsPanel />
    </ProtectedPage>
  );
}
