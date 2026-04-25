# Wheel Strat Tracker — CLAUDE.md

Full context for the AI assistant. Read this at the start of every session.

---

## What This App Does

A personal options trading tracker built around the **wheel strategy** — selling Cash Secured Puts (CSPs) until assigned stock, then selling Covered Calls (CCs) against those shares until called away, repeating. The app tracks:

- Option trades (CSPs, CCs, naked Puts/Calls) with full P&L, premium capture, and close reasons
- Stock lots (assigned shares) with cost basis tracking that automatically decreases as CC premiums are captured
- Portfolio-level capital deployment, win rates, MTD/YTD P&L, and realized metrics
- A live watchlist with real-time quotes from Yahoo Finance
- Multi-portfolio support with per-user data isolation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL via Prisma 6 |
| Auth | NextAuth v4 with credentials provider (bcrypt passwords) |
| UI | shadcn/ui components + Tailwind CSS v4 |
| Data fetching | SWR (client-side), fetch (server components) |
| Charts | Recharts |
| Tables | TanStack React Table v8 |
| Animations | Framer Motion |
| Date handling | date-fns |
| Toast notifications | Sonner |
| Package manager | pnpm |

---

## File Structure

```
src/
├── app/
│   ├── (protected)/layout.tsx     # Auth guard wrapping all protected pages
│   ├── api/
│   │   ├── account/summary/       # Cross-portfolio account summary
│   │   ├── admin/                 # Admin-only: user list, impersonation
│   │   ├── auth/signup/           # User registration
│   │   ├── portfolios/[id]/
│   │   │   ├── capital-transactions/  # Deposit/withdrawal history
│   │   │   ├── metrics/           # KPI calculations
│   │   │   ├── detail-metrics/    # Extended dashboard metrics
│   │   │   └── route.ts           # Portfolio CRUD
│   │   ├── quotes/                # Yahoo Finance live price proxy
│   │   ├── reports/closed/        # Closed trade report with date filters
│   │   ├── stocks/
│   │   │   ├── route.ts           # List / create stock lots
│   │   │   └── [id]/route.ts      # Get / partial-sell / full-close stock lot
│   │   ├── trades/
│   │   │   ├── route.ts           # List / create trades
│   │   │   ├── [id]/route.ts      # Get / edit trade
│   │   │   ├── [id]/add/route.ts  # Add contracts to existing trade
│   │   │   └── [id]/close/route.ts # Close trade (manual / expiredWorthless / assigned)
│   │   ├── user/                  # Profile and password update
│   │   └── watchlist/             # Watchlist CRUD
│   ├── admin/page.tsx
│   ├── changelog/page.tsx
│   ├── portfolios/[portfolioId]/
│   │   ├── page.tsx               # Portfolio detail (tabbed)
│   │   ├── stocks/[stockId]/page.tsx   # Stock lot detail
│   │   └── trades/[tradeId]/page.tsx   # Trade detail
│   ├── summary/page.tsx           # All Accounts dashboard
│   ├── watchlist/page.tsx
│   ├── settings/page.tsx
│   ├── login/page.tsx
│   └── signup/page.tsx
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx           # Root layout with sidebar
│   │   ├── AppSidebar.tsx         # Left sidebar with portfolio links + health dots
│   │   └── VersionBadge.tsx
│   └── ui/                        # shadcn/ui primitives (do not heavily customise)
│
├── data/
│   └── changelog.ts               # All release entries — add new entry here on every feature
│
├── features/                      # Domain-sliced feature modules
│   ├── admin/
│   ├── auth/
│   ├── changelog/
│   ├── portfolios/
│   │   ├── components/
│   │   │   ├── PortfolioDetail.tsx    # Tabbed portfolio view (Overview/Positions/Activity/Report)
│   │   │   ├── PortfolioSettings.tsx  # Slide-out settings drawer
│   │   │   └── PortfolioPageClient.tsx
│   │   └── hooks/
│   ├── reports/
│   ├── stocks/
│   │   └── components/
│   │       ├── StockDetailPageClient.tsx  # Stock lot detail dashboard
│   │       ├── StocksTable.tsx            # Open lots table
│   │       ├── CloseStockModal.tsx        # Partial or full share sell modal
│   │       ├── AddStockModal.tsx
│   │       └── AdminEditStockModal.tsx
│   ├── summary/
│   ├── trades/
│   │   └── components/
│   │       ├── AddTradeModal.tsx          # Create new trade (supports prefill + lockPrefill)
│   │       ├── AddToTradeModal.tsx        # Add contracts to existing trade
│   │       ├── CloseTradeModal.tsx        # Close trade with assignment/expiry/manual paths
│   │       ├── TradeDetailPageClient.tsx
│   │       ├── TypeBadge.tsx              # Colored pill: CSP=blue, CC=violet, Put=amber, Call=green
│   │       └── TradeTables/              # Open and closed trade tables with columns
│   └── watchlist/
│
├── lib/
│   ├── tradeMetrics.ts            # P&L calculation helpers
│   ├── formatDateOnly.ts          # UTC-safe date formatting
│   └── utils.ts                   # cn() and misc
│
├── server/
│   ├── auth/
│   │   ├── auth.ts                # NextAuth config
│   │   ├── getEffectiveUserId.ts  # Resolves real vs impersonated user
│   │   └── password.ts            # bcrypt helpers
│   └── prisma.ts                  # Prisma client singleton
│
└── types/index.ts                 # Shared TS interfaces (Trade, StockLot, Portfolio, etc.)
```

---

## Database Schema (Prisma)

### Key models

**User** — `id`, `firstName`, `lastName`, `email` (unique), `username` (unique), `password` (bcrypt), `isAdmin`, `bio`, `avatarUrl`

**Portfolio** — belongs to User. Has `startingCapital` (Decimal), `name`, `notes`. Capital history tracked via `CapitalTransaction[]`.

**CapitalTransaction** — `type: deposit | withdrawal`, `amount`, `date`, `note`. Replaces single "additional capital" field. Net capital = startingCapital + sum(deposits) - sum(withdrawals).

**Trade** — core trading record:
- `type: Put | Call | CoveredCall | CashSecuredPut`
- `status: open | closed`
- `contracts` (legacy, same as contractsInitial), `contractsInitial`, `contractsOpen` (decrements on partial closes)
- `contractPrice` — premium per contract at open
- `closingPrice` — premium per contract at close
- `premiumCaptured` — running realized P&L (accumulates across partial closes)
- `closeReason: manual | expiredWorthless | assigned`
- `stockLotId` — FK to StockLot (required for CoveredCall, null otherwise)

**StockLot** — tracks a share position:
- `shares: Int` — current share count (decrements on partial sells)
- `avgCost: Decimal(18,6)` — per-share cost basis (decrements as CC premiums captured)
- `status: OPEN | CLOSED`
- `realizedPnl: Decimal(18,2)` — accumulates across partial sells; final value set on full close
- `closePrice` — only set on the final full close
- `trades[]` — linked CoveredCall trades

**WatchlistItem** — `userId`, `ticker` (unique per user)

---

## Domain Logic: The Wheel Strategy

### Trade lifecycle

```
CSP sold → expires worthless (keep premium)
         → assigned (stock put to you at strike)
              → StockLot created at net basis (strike - premium)
              → CC sold against lot
                   → CC expires worthless (keep premium, avgCost reduced)
                   → CC assigned (stock called away, StockLot closed at strike)
                   → CC bought back manually (partial or full)
```

### Cost basis tracking (StockLot.avgCost)

Every time a CC closes (any reason except assignment, which uses a separate path), the premium captured reduces the stock lot's per-share cost basis:

```
newAvgCost = max(0, (currentAvgCost * shares - realizedPremium) / shares)
```

This compounds across multiple CC cycles — the "Cost Basis via Covered Calls" section on the stock lot detail page visualizes this history.

### Partial CC closes

When a CC is partially closed (e.g. 1 of 3 contracts), a new closed Trade record is created with `contractsOpen: 0` and the original trade's `contractsOpen` is decremented. The avgCost reduction applies to the partial realized premium only.

### Partial share sells (StockLot)

`PATCH /api/stocks/[id]` with `{ closePrice, sharesToClose }`:
- If `sharesToClose < lot.shares` → partial: reduce `shares`, accumulate `realizedPnl`, keep `status: OPEN`
- If `sharesToClose === lot.shares` → full close: set `status: CLOSED`, `closePrice`, `closedAt`, finalize `realizedPnl`
- Validation: `sharesToClose` cannot exceed `lot.shares - openCcShares` (shares covered by open CCs are blocked)

### Combined CC close + share sell

`PATCH /api/trades/[id]/close` accepts optional `{ sellSharesPrice, sharesToSell }`:
- When present on a CC close, sells `sharesToSell` shares from the linked stock lot in the **same transaction**
- Share P&L uses avgCost **after** the CC premium has been applied (correct accounting order)
- Respects other open CCs on the lot — only sells up to `lot.shares - otherOpenCcShares`
- Works for full closes, partial closes, and expired worthless

### Assignment flows

**CSP assigned** → creates a new StockLot at `netBasis = max(0, strike - contractPrice)`, links the CSP trade to it via `stockLotId`.

**CC assigned** → closes the linked StockLot at the strike price in the same transaction. `stockRealizedPnl = (strike - lotAvgCost) * lotShares`.

---

## API Patterns

### Authentication

All routes call `getServerSession(authOptions)` and check `session?.user?.id`. Admin routes additionally check `session.user.isAdmin`.

**Impersonation**: Admins can impersonate other users via a session cookie. `getEffectiveUserId(userId, isAdmin)` resolves to the target user's ID when impersonating — use this in every data route for correct data isolation.

```typescript
const isAdmin = session.user.isAdmin ?? false;
const userId = await getEffectiveUserId(session.user.id, isAdmin);
// then filter: portfolio: { userId }
```

### Ownership checks

All data queries filter by portfolio ownership unless the user is admin:
```typescript
where: { id, portfolio: isAdmin ? undefined : { userId } }
```

### Decimal handling

Prisma returns `Decimal` objects for money fields. Always wrap in `new Prisma.Decimal(value)` for arithmetic. Use `Prisma.Decimal.max()` to floor at 0 (e.g. avgCost can't go negative).

Decimal fields in the DB: `avgCost`, `closePrice`, `realizedPnl`, `startingCapital`, `amount` (CapitalTransaction). These often serialize to strings over the wire — always `Number(val)` or `toNumber()` before math on the frontend.

### SWR cache invalidation

After any write, call `mutate()` on all affected SWR keys. Standard pattern:
```typescript
await Promise.allSettled([
  mutate(`/api/stocks/${stockId}`),
  mutate(`/api/stocks?portfolioId=...&status=open`),
  mutate(`/api/stocks?portfolioId=...&status=closed`),
  mutate(`/api/portfolios/${portfolioId}/metrics`),
  mutate(`/api/portfolios/${portfolioId}/detail-metrics`),
  mutate("/api/account/summary"),
  mutate("/api/portfolios"),
]);
```

---

## UI Conventions

### Component split
- Server components fetch data and pass it down; client components (marked `"use client"`) handle interactivity
- Feature components live in `src/features/<domain>/components/`
- Shared primitives live in `src/components/ui/` (shadcn — minimize customization)

### Modal pattern
Dialogs use shadcn `Dialog`. State is always reset in a `useEffect` keyed on the `open` prop so stale values don't persist between openings.

### CurrencyInput
Custom component at `src/components/ui/currency-input.tsx`. Always stores both `{ formatted: string, raw: number }`. Use `raw` for API calls and calculations, `formatted` for display.

### Type badge colors
`TypeBadge` component: CSP = blue, CC = violet, Put = amber, Call = green. Used consistently across all trade tables and cards.

### Money formatting
```typescript
// Full precision display
new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
// Two decimal places
moneyCompact(n) // $123.45
// Compact with fallback
formatMoney(n) // returns "—" for non-finite
```

### Tone system (stat cards)
`tone: "default" | "success" | "danger"` — maps to neutral / emerald / rose colors. Used in `LotStat`, `MetricsCard`, and similar display components.

### Tables
TanStack React Table v8 with `getCoreRowModel()`. Column definitions are built outside render with `useMemo`. Row click handlers use `router.push()` to navigate to detail pages.

### AddTradeModal prefill system
```typescript
prefill?: { ticker?, type?, stockLotId?, contracts? }
lockPrefill?: boolean          // locks fields that have prefill values
defaultContracts?: number      // pre-fills contracts but does NOT lock (editable)
maxContracts?: number          // shows "Up to N contracts" helper text
```
When opening a CC from a stock lot detail page: pass `ticker`, `type`, `stockLotId` in `prefill` + `lockPrefill`, but use `defaultContracts`/`maxContracts` separately so contracts stay editable.

---

## Key Business Rules

1. **CoveredCall must link to an open StockLot** with matching ticker and sufficient shares (`contracts * 100 <= lot.shares`).
2. **Cannot sell shares covered by open CCs** — `sharesToClose` is capped at `lot.shares - sum(openCcContracts * 100)`.
3. **Assignment requires full close** — partial assignment is not supported.
4. **avgCost floors at 0** — premium capture cannot make cost basis negative.
5. **realizedPnl on StockLot is cumulative** — partial sells accumulate into it; the final full close adds its portion on top.
6. **CC premium is applied before share P&L in combined close** — the transaction order is: close CC → reduce avgCost → sell shares using updated avgCost.

---

## Admin Features

- **Impersonation**: Session stores `impersonating: userId`. `getEffectiveUserId` reads this. Amber banner shown in `ImpersonationBanner`.
- **Admin edit trade**: `Shield/Edit` button on trade detail. `PATCH /api/trades/[id]` with `adminEdit: true` bypasses normal validation.
- **Admin edit stock lot**: Same pattern. `PATCH /api/stocks/[id]` with `adminEdit: true`.
- **User management**: `/admin` page — reset password, delete user + all data, toggle admin, impersonate.

---

## Changelog

Release history lives in `src/data/changelog.ts`. **Always add a new entry when shipping a feature.** The latest version auto-populates on the login page and changelog page. Format:

```typescript
{
  date: "YYYY-MM-DD",
  version: "vX.Y.Z",
  highlights: [
    "User-facing description of what changed — written for the end user, not the developer.",
  ],
}
```

Current latest: **v2.9.1** (2026-04-25)

---

## Recent Work (Session History)

### v2.9.0 — 2026-04-24
**Partial CC sells + partial share sells + combined close**

1. **Partial CCs from stock lot** (`StockDetailPageClient.tsx`, `AddTradeModal.tsx`)
   - Removed `contracts` from locked `prefill`
   - Added `defaultContracts` + `maxContracts` props to `AddTradeModal` — pre-fills but stays editable
   - "Up to N contracts (N×100 shares)" helper text shown below input

2. **Partial share sells** (`/api/stocks/[id]/route.ts`, `CloseStockModal.tsx`)
   - API: `sharesToClose` param — partial path reduces `shares` + accumulates `realizedPnl`; full path sets `status: CLOSED`
   - API validates: cannot exceed `lot.shares - openCcShares`
   - Modal: renamed to "Sell Shares", added shares input defaulting to max sellable, shows CC constraint warning
   - StockDetailPageClient shows partial realized P&L card when lot is still open

3. **Combined CC + share close** (`/api/trades/[id]/close/route.ts`, `CloseTradeModal.tsx`)
   - API: optional `sellSharesPrice` + `sharesToSell` on CC close
   - Share sell runs in the same transaction, after avgCost reduction
   - UI: "Also sell N shares at close" checkbox appears on CC close modal (hidden when assigning)
   - Share price pre-fills with strike price when checkbox is toggled on (editable)

---

## Environment

- **Dev**: `pnpm dev` (Next.js on port 3000)
- **DB reset**: `pnpm reset` (force-push schema + re-seed)
- **Type check**: `npx tsc --noEmit`
- **DB**: PostgreSQL (local dev + Vercel Postgres in prod)
- **Quotes**: Yahoo Finance scraping via `/api/quotes?tickers=AAPL,META` — no API key needed but rate-limited; 60s refresh interval client-side
