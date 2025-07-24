"use client"

import { useSession } from "next-auth/react"

export function Header() {
  const { data: session, status } = useSession()

 if (status === "loading") {
  return <div className="px-4 py-2">Loading session...</div>
}


  console.log("[Header] Rendered")
  return <div>Hello, {session?.user?.username}</div>
  
}
