import SettingsForm from "@/components/settings/settings-form";
import ProtectedPage from "@/components/protected-page";

export default function SettingsPage() {
  return (
    <ProtectedPage>
      <SettingsForm />
    </ProtectedPage>
  );
}
