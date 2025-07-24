import ProtectedPage from "@/components/protected-page";
import DashboardContent from "@/components/dashboard-content";

export default function DashboardPage() {
  return (
    <ProtectedPage>
      <DashboardContent />
    </ProtectedPage>
  );
}
