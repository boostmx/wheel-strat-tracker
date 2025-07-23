import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function PositionsPage() {
  const session = await getServerSession(authOptions)

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-4">
        Welcome, {session?.user?.username}
      </h1>
      <p className="text-muted-foreground">No trades yet. Start by entering your first position.</p>
    </div>
  )
}
