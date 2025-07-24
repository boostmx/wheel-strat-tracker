"use client"

import { usePathname } from "next/navigation"
import { SessionProvider } from "next-auth/react"
import { SiteHeader } from "@/components/site-header"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const hideHeaderRoutes = ["/login"]
  const showHeader = !hideHeaderRoutes.includes(pathname)

  return (
    <SessionProvider>
      {showHeader && <SiteHeader />}
      {children}
    </SessionProvider>
  )
}
