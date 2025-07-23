"use client"

import { useSession } from "next-auth/react"
import { LogoutButton } from "@/components/logout-button"
import Link from "next/link"

export function SiteHeader() {
  console.log("[SiteHeader] Session hook active")

  const { data: session, status } = useSession()
  if (status === "loading") {
    return null // 🔄 or <LoadingSpinner />
  }
  
  return (
    <header className="w-full border-b py-4 px-6 flex items-center justify-between">
      <nav className="flex gap-4">
        <Link href="/positions">Positions</Link>
        <Link href="/new">New Trade</Link>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {session?.user?.username}
        </span>
        <LogoutButton />
      </div>
    </header>
  )

  

}
