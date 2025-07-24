import { PortfolioPageClient } from "@/components/portfolio-page-client"

export default function Page({ params }: { params: { id: string } }) {
  return <PortfolioPageClient id={params.id} />
}
