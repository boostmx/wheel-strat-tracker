import { prisma } from "@/server/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { hashPassword, verifyPassword } from "@/server/auth/password";

type PasswordPayload = {
  currentPassword?: string;
  newPassword?: string;
};

type WithEitherPassword = {
  passwordHash?: string | null;
  password?: string | null;
};

function getStoredHash(u: unknown): string | null {
  const hasHash = u as WithEitherPassword;
  return hasHash.passwordHash ?? hasHash.password ?? null;
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = (await req
    .json()
    .catch(() => ({}))) as PasswordPayload;

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const storedHash = getStoredHash(user);
  const ok = await verifyPassword(currentPassword, storedHash);

  if (!ok) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 },
    );
  }

  const newHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: {
      // Prefer passwordHash if your schema has it; otherwise fall back to password
      ...(Object.prototype.hasOwnProperty.call(user, "passwordHash")
        ? { passwordHash: newHash }
        : { password: newHash }),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}
