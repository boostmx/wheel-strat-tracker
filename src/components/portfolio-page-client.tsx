import { PortfolioDetail } from "./portfolio-detail"
import { notFound } from "next/navigation"

interface Props {
  id: string
}

export async function PortfolioPageClient({ id }: Props) {
    console.log("ID:", id);
    
  try {
    const baseUrl =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"

    const res = await fetch(`${baseUrl}/api/portfolios/${id}`, {
      cache: "no-store",
    })

    if (!res.ok) return notFound()

    const portfolio = await res.json()
    console.log("Portfolio:", portfolio);
    return <PortfolioDetail portfolio={portfolio} />
  } catch (err) {
    console.error("Failed to fetch portfolio", err)
    return notFound()
  }
}
