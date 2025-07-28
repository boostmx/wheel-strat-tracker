import { headers } from "next/headers";
import { PortfolioDetail } from "./portfolio-detail";
import { notFound } from "next/navigation";

export async function PortfolioPageClient({ id }: { id: string }) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const headersList = await headers();
  const cookie = headersList.get("cookie") || "";

  const res = await fetch(`${baseUrl}/api/portfolios/${id}`, {
    cache: "no-store",
    headers: {
      Cookie: cookie,
    },
  });

  if (!res.ok) return notFound();

  const portfolio = await res.json();

  return <PortfolioDetail portfolio={portfolio} />;
}
