import ProtectedPage from "@/features/auth/components/ProtectedPage";
import WatchlistPageContent from "@/features/watchlist/components/WatchlistPageContent";

export default function WatchlistPage() {
  return (
    <ProtectedPage>
      <WatchlistPageContent />
    </ProtectedPage>
  );
}
