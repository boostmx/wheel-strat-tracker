import { prisma } from "@/server/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      bio: true,
      avatarUrl: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

type ProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  bio?: string;
};

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as ProfilePayload;

  const hasChanges =
    typeof body.firstName === "string" ||
    typeof body.lastName === "string" ||
    typeof body.email === "string" ||
    typeof body.bio === "string";

  if (!hasChanges) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  if (typeof body.email === "string") {
    const existing = await prisma.user.findFirst({ where: { email: body.email } });
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(typeof body.firstName === "string" ? { firstName: body.firstName } : {}),
      ...(typeof body.lastName === "string" ? { lastName: body.lastName } : {}),
      ...(typeof body.email === "string" ? { email: body.email } : {}),
      ...(typeof body.bio === "string" ? { bio: body.bio } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      bio: true,
    },
  });

  return NextResponse.json(updated);
}
