import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { prisma } from "@/server/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { isAdmin } = await req.json();

  if (id === session.user.id && isAdmin === false) {
    return NextResponse.json(
      { error: "Cannot remove your own admin status" },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isAdmin },
    select: { id: true, isAdmin: true },
  });

  return NextResponse.json(updated);
}
