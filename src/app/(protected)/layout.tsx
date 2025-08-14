// src/app/(protected)/layout.tsx
import ProtectedPage from "@/components/protected-page";

export default function ProtectedLayout({
  children,
}: { children: React.ReactNode }) {
  return <ProtectedPage>{children}</ProtectedPage>;
}