import ProtectedPage from "@/components/protected-page";
import { PortfolioPageClient } from "@/components/portfolio-page-client";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = await params.id;

  return (
    <ProtectedPage>
      <PortfolioPageClient id={id} />
    </ProtectedPage>
  );
}
