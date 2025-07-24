import { PortfolioDetail } from "./portfolio-detail";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

export async function PortfolioPageClient({ id }: { id: string }) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const cookieStore = cookies();

  const res = await fetch(`${baseUrl}/api/portfolios/${id}`, {
    cache: "no-store",
    headers: {
      Cookie: cookieStore.toString(),
    },
  });

  if (!res.ok) return notFound();

  const portfolio = await res.json();

  return <PortfolioDetail portfolio={portfolio} />;
}
