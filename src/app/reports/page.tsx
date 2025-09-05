import ProtectedPage from "@/features/auth/components/ProtectedPage";
import AccountReportsContent from "@/features/reports/components/AccountReportsContent";

export default function ReportsPage() {
  return (
    <ProtectedPage>
      <AccountReportsContent />
    </ProtectedPage>
  );
}