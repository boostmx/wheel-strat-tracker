// api/portfolios/[id]/route.ts
// This file handles operations for a specific portfolio identified by its ID.
import { auth } from "@/server/auth/auth";
import { prisma } from "@/server/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getEffectiveUserId } from "@/server/auth/getEffectiveUserId";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await props.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const uid = await getEffectiveUserId(session.user.id, session.user.isAdmin ?? false);
    const where = session.user.isAdmin ? { id: params.id } : { id: params.id, userId: uid };
    const portfolio = await prisma.portfolio.findFirst({ where });

    if (!portfolio) {
      return NextResponse.json(
        { error: "Portfolio not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(portfolio);
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const id = await params.id;

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleteWhere = session.user.isAdmin ? { id } : { id, userId: session.user.id };
    await prisma.portfolio.deleteMany({ where: deleteWhere });

    return NextResponse.json({ message: "Portfolio deleted" });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const id = await params.id;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, startingCapital, additionalCapital, notes } = body;

    const patchWhere = session.user.isAdmin ? { id } : { id, userId: session.user.id };
    const updated = await prisma.portfolio.updateMany({
      where: patchWhere,
      data: {
        ...(name !== undefined && { name }),
        ...(startingCapital !== undefined && {
          startingCapital: new Prisma.Decimal(startingCapital),
        }),
        ...(additionalCapital !== undefined && {
          additionalCapital: new Prisma.Decimal(additionalCapital),
        }),
        ...(notes !== undefined && { notes }),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Portfolio not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: "Portfolio updated" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
