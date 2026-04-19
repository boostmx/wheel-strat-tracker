import { NextResponse } from "next/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// Merged into /api/portfolios/[id]/metrics — forward for backwards compatibility.
export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const url = new URL(req.url);
  const target = new URL(`/api/portfolios/${id}/metrics`, url.origin);
  target.search = url.search;
  return NextResponse.redirect(target, { status: 307 });
}
