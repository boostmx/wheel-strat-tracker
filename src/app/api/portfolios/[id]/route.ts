import { auth } from "@/server/auth/auth";
import { prisma } from "@/server/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

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
    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

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
    await prisma.portfolio.deleteMany({
      where: {
        id,
        userId: session.user.id,
      },
    });

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

    const updated = await prisma.portfolio.updateMany({
      where: {
        id,
        userId: session.user.id,
      },
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
