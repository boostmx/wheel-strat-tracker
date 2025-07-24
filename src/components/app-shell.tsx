"use client"

import { SessionProvider } from "next-auth/react"

export default function AppShell({ children }: { children: React.ReactNode }) {
    console.log("[AppShell] Rendered")
  return <SessionProvider>{children}</SessionProvider>
}
