import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type ProfilePayload = {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  email?: string;
};

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as ProfilePayload;

  const hasChanges =
    typeof body.firstName === "string" ||
    typeof body.lastName === "string" ||
    typeof body.avatarUrl === "string" ||
    typeof body.email === "string";

  if (!hasChanges) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  if (typeof body.email === "string") {
    const existingUser = await prisma.user.findFirst({
      where: { email: body.email },
    });
    if (existingUser && existingUser.id !== sessionUser.id) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: sessionUser.id },
    data: {
      ...(typeof body.firstName === "string"
        ? { firstName: body.firstName }
        : {}),
      ...(typeof body.lastName === "string" ? { lastName: body.lastName } : {}),
      ...(typeof body.avatarUrl === "string" ? { image: body.avatarUrl } : {}),
      ...(typeof body.email === "string" ? { email: body.email } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      username: true,
      email: true,
    },
  });

  return NextResponse.json(updated);
}
