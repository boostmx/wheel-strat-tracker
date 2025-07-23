"use client"

import { useSession } from "next-auth/react"

export function DebugSession() {
  const { data: session, status } = useSession()

  return (
    <pre className="text-sm bg-muted p-4 rounded">
      {JSON.stringify({ session, status }, null, 2)}
    </pre>
  )
}
