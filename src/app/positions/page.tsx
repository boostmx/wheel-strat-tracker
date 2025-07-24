import ProtectedPage from "@/components/protected-page";

// app/positions/page.tsx
export default function PositionsPage() {
  return (
    <ProtectedPage>
      <h1 className="text-3xl font-bold">Welcome to your positions</h1>
      <p className="text-muted-foreground">
        No trades yet. Start by entering your first position.
      </p>
    </ProtectedPage>
  );
}
