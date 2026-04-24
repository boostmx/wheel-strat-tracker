# 🌀 Wheel Strategy Tracker

**Developed by HL Financial Strategies**

A purpose-built app for options traders running the Wheel Strategy. Track every position across multiple portfolios, monitor capital deployment in real time, and review your performance — all without a spreadsheet.

---

## What It Does

Most brokerage platforms aren't built for Wheel traders. They show you positions but not the full picture — how much of your capital is deployed, what your average hold time is, whether you're actually profitable after all your covered calls. This app fills that gap.

You get a clean dashboard that knows what a Cash Secured Put is, what Assigned means, and how a covered call ties back to the stock lot underneath it. Every metric is calculated the way a Wheel trader would calculate it.

---

## Highlights

**Real-time Portfolio Dashboard**  
Current capital, cash available, deployment percentage, and total P&L at a glance. A P&L chart with six time views (Daily through All Time) shows exactly when you made money and when you didn't.

**Full Position Lifecycle**  
Open a CSP, get assigned, write covered calls against the lot — every step is tracked and linked. Close trades as Expired Worthless, Assigned, or Manual, and the numbers update instantly. Add to an existing position and it auto-logs the entry in the trade notes.

**Stock Lot Tracking**  
Covered calls are attached to their underlying stock lot. A cost basis reduction card shows your original average cost, your running average after all the premiums you've collected, and what your projected average will be if current CCs expire worthless.

**Capital Management**  
Set a starting capital per portfolio, then log deposits and withdrawals as they happen. Every transaction is dated, noted, and kept in a clean history — so your capital base always reflects what's actually in the account, not a number you manually updated once.

**Watchlist**  
A dedicated watchlist page shows live prices, day change, 52-week range, and volume for all your open positions and any tickers you're monitoring. Positions auto-populate from your trades. Prices refresh every 60 seconds.

**Reports & CSV Export**  
Filter closed trades by portfolio and date range, see win rate with full W/L breakdown, best and worst trade, average hold time, and close reason summary. Export everything to CSV formatted for a monthly review.

**Built for Mobile**  
Every page has a proper mobile layout — positions, tables, modals, and charts all work on a phone without horizontal scrolling or tiny tap targets.

---

## Tech Stack

- **Next.js 15** (App Router) — **PostgreSQL** via Railway — **Prisma** ORM  
- **NextAuth** authentication — **SWR** data fetching — **Tailwind CSS** + **shadcn/ui**  
- Deployed on **Vercel** at `wheeltracker.hlfinancialstrategies.com`

---

## Local Setup

```bash
git clone https://github.com/yourusername/wheel-strategy-tracker.git
cd wheel-strategy-tracker
pnpm install
```

Create a `.env` file:

```env
DATABASE_URL=postgresql://your-db-url
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_URL=http://localhost:3000
```

Set up the database and seed sample data:

```bash
npx prisma db push
npx prisma generate
pnpm tsx prisma/seed.ts
```

Run the app:

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## License

MIT License © 2025 HL Financial Strategies
