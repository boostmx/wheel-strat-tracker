import { prisma } from "../src/lib/prisma";
import bcrypt from "bcrypt";

async function main() {
  const email = process.env.ADMIN_EMAIL!;
  const username = process.env.ADMIN_USERNAME || "admin";
  const firstName = process.env.ADMIN_FIRSTNAME || "Admin";
  const lastName = process.env.ADMIN_LASTNAME || "User";
  const plainPassword = process.env.ADMIN_PASSWORD!;

  if (!plainPassword || !email) {
    throw new Error("Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment");
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  // 🧼 Clean up existing data
  await prisma.trade.deleteMany({});
  await prisma.portfolio.deleteMany({});
  await prisma.user.deleteMany({});

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      username,
      password: hashedPassword,
      firstName,
      lastName,
      isAdmin: true
    },
  });

  console.log("✅ Admin user created.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });