"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"

export function SiteHeader() {
  const { data: session, status } = useSession()

  if (status === "loading") return null

  return (
    <header className="w-full border-b px-6 py-4 flex items-center justify-between bg-white shadow-sm">
      <div className="flex items-center space-x-4">
        <Link href="/positions" className="text-lg font-semibold hover:underline">Portfolio</Link>
        <Link href="/dashboard" className="text-lg font-semibold hover:underline">Dashboard</Link>
        <Link href="/trades/new" className="text-lg font-semibold hover:underline">New Trade</Link>
      </div>

      <div className="flex items-center space-x-4">
        {session?.user?.username && (
          <span className="text-sm text-gray-600">Hi, <strong>{session.user.username}</strong></span>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded border"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
