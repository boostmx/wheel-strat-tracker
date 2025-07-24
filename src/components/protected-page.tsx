import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

type ProtectedPageProps = {
  children: ReactNode;
};

export default async function ProtectedPage({ children }: ProtectedPageProps) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
