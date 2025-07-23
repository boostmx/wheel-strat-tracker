import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import prisma from '@/lib/prisma'

export async function GET() {
  const existing = await prisma.user.findFirst({
    where: { username: 'admin' },
  })
  if (existing) {
    return NextResponse.json({ message: 'User already exists' })
  }

  const hashed = await bcrypt.hash('admin', 10)

  const user = await prisma.user.create({
    data: {
      username: 'admin',
      password: hashed,
      portfolios: {
        create: {
          name: 'Default Portfolio',
        },
      },
    },
  })

  return NextResponse.json({ message: 'User created', user })
}
