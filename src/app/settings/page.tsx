import SettingsForm from "@/features/settings/components/SettingsForm";
import ProtectedPage from "@/features/auth/components/ProtectedPage";

export default function SettingsPage() {
  return (
    <ProtectedPage>
      <SettingsForm />
    </ProtectedPage>
  );
}
