import { headers } from "next/headers";
import { PortfolioDetail } from "./portfolio-detail";
import { notFound } from "next/navigation";
import { getBaseUrl } from "@/lib/getBaseUrl";

export async function PortfolioPageClient({ id }: { id: string }) {
  const baseUrl = await getBaseUrl(); // Use the utility function for the base URL
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
