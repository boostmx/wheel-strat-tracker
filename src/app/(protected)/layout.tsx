// src/app/(protected)/layout.tsx
import ProtectedPage from "@/features/auth/components/ProtectedPage";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedPage>{children}</ProtectedPage>;
}
