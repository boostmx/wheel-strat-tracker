"use client"

import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"

type Props = {
  children: React.ReactNode
  session: Session | null
}

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}

