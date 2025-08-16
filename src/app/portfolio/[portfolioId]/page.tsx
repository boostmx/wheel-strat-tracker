import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getBaseUrl } from "@/lib/getBaseUrl";
import PortfolioPageClient from "@/components/portfolio-page-client"; // make this a regular component
import ProtectedPage from "@/components/protected-page";

export default async function Page(props: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await props.params;

  const baseUrl = await getBaseUrl();
  const headersList = await headers();
  const cookie = headersList.get("cookie") || "";

  const res = await fetch(`${baseUrl}/api/portfolios/${portfolioId}`, {
    cache: "no-store",
    headers: {
      Cookie: cookie,
    },
  });

  if (!res.ok) return notFound();

  const portfolio = await res.json();

  return (
    <ProtectedPage>
      <PortfolioPageClient portfolio={portfolio} />
    </ProtectedPage>
  );

}
