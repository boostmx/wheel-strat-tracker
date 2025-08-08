# 🌀 Wheel Strategy Tracker

**Developed by HL Financial Strategies**  
Track and manage your Wheel Strategy trades — monitor puts, calls, covered calls, capital used, and percent returns, all in one dashboard.

---

## Features

- Secure authentication (NextAuth with credentials provider)
- Track open and closed positions by portfolio
- Multiple portfolio support
- Capture contract price, expiration, strike, premium, and P/L
- Close trades partially or fully with real-time metrics
- Clean dashboard with modals
- Custom domain support: `wheeltracker.hlfinancialstrategies.com`
- Upcoming features to include: real time dashboard updates, monitoring, trade details, and more

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL (hosted via Railway)
- **ORM**: Prisma
- **Authentication**: NextAuth
- **Data Fetching**: SWR
- **Styling/UI**: TailwindCSS, ShadCN
- **Deployment**: Vercel
- **Package Manager**: pnpm

---

## Getting Started (Local Setup)

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/wheel-strategy-tracker.git
cd wheel-strategy-tracker
pnpm install
```

### 2. Set up your `.env` file

Create a `.env` file in the project root and add:

```env
DATABASE_URL=postgresql://your-db-url
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_URL=http://localhost:3000
```

You can generate a secure secret using:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set up the database

```bash
pnpm prisma migrate dev --name init
pnpm prisma generate
```

### 4. Seed production data (admin user only)

```bash
pnpm ts-node prisma/seed.production.ts
```

This script will:

- Clear existing trades and portfolios
- Create a new admin user based on env vars

---

## 🧪 Running the App

```bash
pnpm dev
```

Then visit [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable          | Description                   |
| ----------------- | ----------------------------- |
| `DATABASE_URL`    | PostgreSQL connection string  |
| `NEXTAUTH_SECRET` | Session encryption secret     |
| `NEXTAUTH_URL`    | Required in production        |
| `ADMIN_EMAIL`     | Used during seeding           |
| `ADMIN_PASSWORD`  | Used during seeding           |
| `ADMIN_USERNAME`  | Optional, defaults to `admin` |

---

## Deployment (Vercel + Railway)

1. Push your code to GitHub
2. Import project into [Vercel](https://vercel.com)
3. Add required env variables under Project → Settings
4. Link to your PostgreSQL instance in [Railway](https://railway.app)
5. Set your domain (`wheeltracker.hlfinancialstrategies.com`) as **primary**
6. Deploy

---

## Project Structure

```
/app               → App Router pages and layouts
/components        → UI and logic components
/lib               → Auth, utils, Prisma
/prisma            → Schema and seed scripts
/public            → Static assets
```

---

## 🪪 License

MIT License © 2025 HL Financial Strategies
