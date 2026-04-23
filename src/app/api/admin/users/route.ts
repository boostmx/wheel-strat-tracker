import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { prisma } from "@/server/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      isAdmin: true,
      createdAt: true,
      _count: { select: { portfolios: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}
