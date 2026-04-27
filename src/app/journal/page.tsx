import ProtectedPage from "@/features/auth/components/ProtectedPage";
import JournalPageContent from "@/features/journal/components/JournalPageContent";

export default function JournalPage() {
  return (
    <ProtectedPage>
      <JournalPageContent />
    </ProtectedPage>
  );
}
