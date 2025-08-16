import { prisma } from "../src/lib/prisma";
import bcrypt from "bcrypt";

async function main() {
  // 🧼 Clean up existing data
  //await prisma.trade.deleteMany({});
  //await prisma.portfolio.deleteMany({});
  //await prisma.user.deleteMany({});

  const testUserId = "test-user-id";
  const testUsername = "admin";
  const testPassword = "admin"; // plaintext for testing
  const passwordHash = await bcrypt.hash(testPassword, 10);

  // ✅ Upsert test user
  const user = await prisma.user.upsert({
    where: { id: testUserId },
    update: {},
    create: {
      id: testUserId,
      username: testUsername,
      password: passwordHash,
      firstName: "Admin",
      lastName: "Administrator",
      email: "hung@example.com",
      bio: "Builder of the Wheel Strat Tracker",
      avatarUrl: "https://example.com/avatar-hung.png",
      isAdmin: true,
    },
  });

  console.log(`👤 Seeded user: ${user.username}`);

  // await prisma.user.createMany({
  //   data: [
  //     // password: test123
  //     {
  //       id: "user-2",
  //       username: "wheelie",
  //       password: await bcrypt.hash("test123", 10),
  //       firstName: "Will",
  //       lastName: "Lee",
  //       email: "wheelie@example.com",
  //       avatarUrl: "https://example.com/avatar-wheelie.png",
  //       isAdmin: false,
  //     },
  //     // password: securepass
  //     {
  //       id: "user-3",
  //       username: "stratlord",
  //       password: await bcrypt.hash("securepass", 10),
  //       firstName: "Strat",
  //       lastName: "Lord",
  //       email: "stratlord@example.com",
  //       avatarUrl: "https://example.com/avatar-stratlord.png",
  //       isAdmin: false,
  //     },
  //   ],
  //   skipDuplicates: true,
  // });

  // console.log("👥 Additional test users seeded");

  // ✅ Check if portfolio already exists
  const existingPortfolio = await prisma.portfolio.findFirst({
    where: { userId: user.id },
  });

  if (existingPortfolio) {
    console.log(
      "📦 Portfolio already exists. Skipping portfolio/trade seeding.",
    );
    return;
  }

  // ✅ Create a test portfolio
  const portfolio = await prisma.portfolio.create({
    data: {
      name: "Test Portfolio",
      userId: user.id,
      startingCapital: 500000,
      additionalCapital: 0,
    },
  });

  console.log(`📦 Created portfolio: ${portfolio.name}`);

  // ✅ Add some trades to the portfolio
  await prisma.trade.createMany({
    data: [
      // Open CSP on AAPL
      {
        ticker: "AAPL",
        strikePrice: 180,
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week out
        type: "CashSecuredPut",
        contracts: 1,
        contractPrice: 2.6,
        entryPrice: 182.5,
        status: "open",
        portfolioId: portfolio.id,
      },
      // Closed CC on TSLA
      {
        ticker: "TSLA",
        strikePrice: 250,
        expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks out
        type: "CoveredCall",
        contracts: 2,
        contractPrice: 3.15,
        entryPrice: 255,
        status: "closed",
        premiumCaptured: 630,
        closingPrice: 0.05,
        closedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // closed yesterday
        portfolioId: portfolio.id,
        percentPL: 34.23,
      },
      // Open CSP on NVDA
      {
        ticker: "NVDA",
        strikePrice: 400,
        expirationDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 3 weeks out
        type: "CashSecuredPut",
        contracts: 3,
        contractPrice: 6.1,
        entryPrice: 410,
        status: "open",
        portfolioId: portfolio.id,
      },
      // Closed CSP on META
      {
        ticker: "META",
        strikePrice: 300,
        expirationDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // expired 1 week ago
        type: "CashSecuredPut",
        contracts: 1,
        contractPrice: 2.0,
        entryPrice: 303,
        status: "closed",
        premiumCaptured: 200,
        closingPrice: 0,
        closedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        portfolioId: portfolio.id,
        percentPL: 45.87,
      },
      // Open CC on MSFT
      {
        ticker: "MSFT",
        strikePrice: 350,
        expirationDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 4 weeks out
        type: "CoveredCall",
        contracts: 1,
        contractPrice: 4.5,
        entryPrice: 352,
        status: "open",
        portfolioId: portfolio.id,
      },
      // Closed CC on AMZN
      {
        ticker: "AMZN",
        strikePrice: 140,
        expirationDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // expired 2 weeks ago
        type: "CoveredCall",
        contracts: 2,
        contractPrice: 2.8,
        entryPrice: 142,
        status: "closed",
        premiumCaptured: 560,
        closingPrice: 0,
        closedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
        portfolioId: portfolio.id,
        percentPL: -15.67,
      },
    ],
  });

  console.log(`📈 Added trades to portfolio`);
}

main()
  .then(() => {
    console.log("🌱 Seed completed.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
