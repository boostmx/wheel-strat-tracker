"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { CreatePortfolioModal } from "@/components/create-portfolio-modal"

interface Portfolio {
  id: string
  name: string | null
}

export default function DashboardContent() {
  const { data: session } = useSession()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPortfolios = async () => {
      try {
        const res = await fetch("/api/portfolio")
        const data = await res.json()
        setPortfolios(data)
      } catch (error) {
        console.error("Failed to fetch portfolios:", error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.id) {
      fetchPortfolios()
    }
  }, [session])

  return (
    <div className="max-w-4xl mx-auto py-16 px-6 space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      {loading ? (
        <p className="text-gray-500">Loading portfolios...</p>
      ) : portfolios.length === 0 ? (
        <div className="rounded-lg border border-gray-200 p-6 text-center shadow-sm bg-white">
          <p className="text-gray-600 mb-4 text-sm">
            You don’t have a portfolio yet.
          </p>
          <CreatePortfolioModal />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-700">Your Portfolios:</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {portfolios.map((p) => (
              <li
                key={p.id}
                className="border rounded-md p-4 shadow-sm bg-white hover:shadow-md transition"
              >
                <Link
                  href={`/portfolio/${p.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {p.name || "Unnamed Portfolio"}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
