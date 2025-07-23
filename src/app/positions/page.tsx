import { Suspense } from "react"
import { ClientHeader } from "@/components/client-header"

export default function PositionsPage() {
  return (
    <>
      <Suspense fallback={null}>
        <ClientHeader />
      </Suspense>
      <main className="max-w-4xl mx-auto py-12 px-4 space-y-6">
        <h1 className="text-3xl font-bold">Welcome to your positions</h1>
        <p className="text-muted-foreground">No trades yet. Start by entering your first position.</p>
      </main>
    </>
  )
}
