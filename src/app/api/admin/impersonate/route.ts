import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { prisma } from "@/server/prisma";
import { cookies } from "next/headers";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8,
};

// Returns current impersonation state — used by the banner
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json(null);
  }

  const store = await cookies();
  const impersonateId = store.get("wt-impersonate")?.value;
  if (!impersonateId) {
    return NextResponse.json(null);
  }

  const user = await prisma.user.findUnique({
    where: { id: impersonateId },
    select: { id: true, username: true, firstName: true, lastName: true },
  });
  if (!user) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    userId: user.id,
    username: user.username,
    name: `${user.firstName} ${user.lastName}`,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await req.json();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, firstName: true, lastName: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const store = await cookies();
  store.set("wt-impersonate", user.id, COOKIE_OPTS);

  return NextResponse.json({ userId: user.id, username: user.username });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const store = await cookies();
  store.delete("wt-impersonate");

  return NextResponse.json({ ok: true });
}
