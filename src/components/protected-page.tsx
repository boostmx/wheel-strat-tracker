import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ReactNode } from "react"

type ProtectedPageProps = {
  children: ReactNode
}

export default async function ProtectedPage({ children }: ProtectedPageProps) {
  const session = await auth()

  console.log("[ProtectedPage] Session:", session)
  if (!session) {
    console.log("[ProtectedPage] No session found, redirecting to login")
    redirect("/login")
  }

  return <>{children}</>
}
