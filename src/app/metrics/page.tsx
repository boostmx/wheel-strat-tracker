import ProtectedPage from "@/components/protected-page";
import MetricsContent from "@/components/metrics-content";

export default function DashboardPage() {
  return (
    <ProtectedPage>
      <MetricsContent />
    </ProtectedPage>
  );
}
