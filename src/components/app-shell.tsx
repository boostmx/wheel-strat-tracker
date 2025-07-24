"use client"

import { usePathname } from "next/navigation"
import { SessionProvider } from "next-auth/react"
import { SiteHeader } from "@/components/site-header"
import { SWRConfig } from "swr"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const hideHeaderRoutes = ["/","/login"]
  const showHeader = !hideHeaderRoutes.includes(pathname)

  return (
    <SessionProvider>
      <SWRConfig
        value={{
          fetcher: (url: string) => fetch(url).then(res => res.json()),
          shouldRetryOnError: false,
        }}
      >
        {showHeader && <SiteHeader />}
        {children}
      </SWRConfig>
    </SessionProvider>
  )
}
