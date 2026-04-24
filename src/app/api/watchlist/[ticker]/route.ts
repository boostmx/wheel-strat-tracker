import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { prisma } from "@/server/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticker } = await params;
  await prisma.watchlistItem.deleteMany({
    where: { userId: session.user.id, ticker: ticker.toUpperCase() },
  });

  return NextResponse.json({ ok: true });
}
