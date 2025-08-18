import ProtectedPage from "@/features/auth/components/ProtectedPage";
import AccountSummaryContent from "@/features/summary/components/AccountSummaryContent";

export default function DashboardPage() {
  return (
    <ProtectedPage>
      <AccountSummaryContent />
    </ProtectedPage>
  );
}
