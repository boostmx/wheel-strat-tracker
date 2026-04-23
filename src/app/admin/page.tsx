import { auth } from "@/server/auth/auth";
import { redirect } from "next/navigation";
import AdminPageContent from "@/features/admin/components/AdminPageContent";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isAdmin) redirect("/summary");
  return <AdminPageContent />;
}
