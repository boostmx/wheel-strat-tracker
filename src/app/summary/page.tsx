import ProtectedPage from "@/components/protected-page";
import AccountSummaryContent from "@/components/account-summary-content";

export default function DashboardPage() {
  return (
    <ProtectedPage>
      <AccountSummaryContent />
    </ProtectedPage>
  );
}
