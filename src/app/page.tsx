import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}
