"use client"

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function LogoutButton() {
  const handleSignOut = async () => {
    toast.success("Signed out successfully")
    await signOut({ callbackUrl: "/login" })
  }

  return (
    <Button variant="outline" onClick={handleSignOut}>
      Sign Out
    </Button>
  )
}
