import { headers } from "next/headers";
import { PortfolioDetail } from "./portfolio-detail";
import { notFound } from "next/navigation";
import { getBaseUrl } from "@/lib/getBaseUrl";

export async function PortfolioPageClient({ id }: { id: string }) {
  const baseUrl = getBaseUrl(); // Use the utility function for the base URL

  const headersList = await headers();
  const cookie = headersList.get("cookie") || "";
  console.log("BaseURL is: " + baseUrl);

  console.log("Fetching portfolio at:", `${baseUrl}/api/portfolios/${id}`);
  const res = await fetch(`${baseUrl}/api/portfolios/${id}`, {
    cache: "no-store",
    headers: {
      Cookie: cookie,
    },
  });
  console.log("Fetched portfolio now at:", `${baseUrl}/api/portfolios/${id}`);
  if (!res.ok) return notFound();

  const portfolio = await res.json();

  return <PortfolioDetail portfolio={portfolio} />;
}
