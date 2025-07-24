import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { json } from "stream/consumers";

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, startingCapital } = await req.json();

  console.log(name + " capital: " + startingCapital)
  if (!name || startingCapital === undefined) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const portfolio = await prisma.portfolio.create({
    data: {
      name,
      userId: session.user.id,
      startingCapital: startingCapital,
      currentCapital: startingCapital,
    },
  });

  return NextResponse.json(portfolio, { status: 201 });
}
