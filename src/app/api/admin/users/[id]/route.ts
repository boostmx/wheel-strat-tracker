import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth";
import { prisma } from "@/server/prisma";
import bcrypt from "bcrypt";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // Toggle admin status
  if (typeof body.isAdmin === "boolean") {
    if (id === session.user.id && body.isAdmin === false) {
      return NextResponse.json(
        { error: "Cannot remove your own admin status" },
        { status: 400 },
      );
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { isAdmin: body.isAdmin },
      select: { id: true, isAdmin: true },
    });
    return NextResponse.json(updated);
  }

  // Reset password
  if (typeof body.password === "string") {
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }
    const hashed = await bcrypt.hash(body.password, 10);
    await prisma.user.update({
      where: { id },
      data: { password: hashed },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "No valid operation" }, { status: 400 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 },
    );
  }

  // Cascade delete via Prisma (Portfolio → Trade/StockLot cascade defined in schema)
  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
