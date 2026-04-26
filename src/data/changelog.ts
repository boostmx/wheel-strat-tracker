export interface ChangelogEntry {
  date: string; // e.g. "2025-08-20"
  version?: string; // e.g. "v0.8.0"
  highlights: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-04-26",
    version: "v2.11.0",
    highlights: [
      "Performance: the Activity tab now loads only the current page of closed trades from the server instead of fetching your entire history upfront. Switching timeframes or pages makes a targeted request rather than filtering thousands of rows in the browser.",
      "Performance: added database indexes on Trade and StockLot for date-range queries, making closed-trade lookups significantly faster as your history grows.",
      "Performance: the closed trades report no longer issues one database query per portfolio — all portfolios are queried in a single round trip.",
      "Performance: all list API routes now request only the fields they actually display, reducing JSON payload size.",
    ],
  },
  {
    date: "2026-04-26",
    version: "v2.10.0",
    highlights: [
      "Watchlist reordering — drag and drop tickers in your watchlist to set a custom order. The order is saved automatically and persists across sessions.",
      "Positions portfolio filter — when you have positions across multiple portfolios, a dropdown appears in the Positions section so you can filter to see only one portfolio at a time.",
    ],
  },
  {
    date: "2026-04-25",
    version: "v2.9.1",
    highlights: [
      "Fixed a bug where assigning a covered call on a partial stock lot would incorrectly close the entire lot instead of only selling the shares covered by the contracts. For example, assigning a 4-contract CC on an 800-share lot now sells 400 shares and leaves the remaining 400 shares open.",
    ],
  },
  {
    date: "2026-04-24",
    version: "v2.9.0",
    highlights: [
      "Partial covered calls from stock lot — the Sell Covered Call button now defaults to the max contracts for your share count but lets you choose any quantity, with an 'Up to N contracts' hint shown inline.",
      "Partial share sells on stock lots — the new Sell Shares modal lets you sell any number of shares from an open lot instead of forcing an all-or-nothing close. Shares covered by open covered calls are automatically blocked from sale and shown clearly in the modal.",
      "Combined CC close + share sell — when closing a covered call (expired worthless, manual buy-to-close, or partial), a new 'Also sell N shares at close' checkbox lets you sell the underlying shares in the same transaction. The share price pre-fills with the strike price and is editable. Share P&L is calculated using the lot's cost basis after the CC premium has already been applied.",
      "Open lots with accumulated realized P&L from partial sells now show a 'Realized P/L (partial)' stat card so you can see your running total even before the lot is fully closed.",
    ],
  },
  {
    date: "2026-04-23",
    version: "v2.8.0",
    highlights: [
      "Portfolio capital management overhauled — deposits and withdrawals are now tracked as individual transactions with an amount, date, and optional note, replacing the single 'additional capital' field.",
      "Every deposit and withdrawal is logged in a persistent history with a running total of deposits, withdrawals, and net adjustment shown below the transaction list.",
      "Portfolio settings moved out of the main tab bar and into a slide-out drawer triggered by the gear icon in the portfolio header — keeps the tabs focused on viewing your positions and keeps destructive actions out of the main flow.",
      "Settings drawer covers portfolio name editing, all capital transaction management, notes, and the danger zone in one scrollable panel.",
      "All inputs in the settings panel now match the rest of the app — the date field uses the same Popover + Calendar picker used in trade forms, and text fields use the standard Input component with proper labels.",
    ],
  },
  {
    date: "2026-04-23",
    version: "v2.7.0",
    highlights: [
      "Watchlist added — a dedicated page showing live prices for all your open positions alongside any tickers you manually track, so you never have to bounce between tabs.",
      "Positions are auto-populated from your open trades and stock lots grouped by ticker. Each position appears as a clickable chip showing the type badge, strike, expiry, contracts, OTM/ITM %, and the portfolio it belongs to — clicking goes straight to that trade or stock detail.",
      "My Watchlist lets you add any ticker with one-click removal. Tickers are validated against Yahoo Finance before being saved so invalid symbols are rejected upfront.",
      "Manual watchlist entries show price, day change, a 52-week range progress bar indicating where the current price sits between the yearly low and high, and today's volume — all refreshing automatically every 60 seconds.",
      "If a manually-tracked ticker also has an open position it's flagged with a Position badge so you can see the overlap at a glance.",
      "Watchlist is fully mobile-responsive — positions and watchlist entries collapse into readable card views on phones instead of overflowing horizontal tables.",
      "Quote data extended across the app to include 52-week high/low, daily high/low, and volume pulled from the existing Yahoo Finance integration.",
    ],
  },
  {
    date: "2026-04-23",
    version: "v2.6.0",
    highlights: [
      "Sign up page redesigned to match the login experience — split-panel layout, first and last name side by side, show/hide password toggles, and client-side length and match validation. Both pages now share the same copy and branding.",
      "Settings page fully overhauled — profile header card with avatar, display name, member-since date, and Admin badge. Bio field added. Password section has show/hide toggles and an inline mismatch hint.",
      "Admin gets its own dedicated /admin page with a tabbed layout, keeping user management completely separate from personal account settings.",
      "User management: admins can impersonate any user (amber banner shows who you're viewing with a one-click Exit), reset passwords directly, delete users and all their data with a confirmation step, and toggle admin access.",
      "Impersonation fully wires into the app — sidebar, dashboard, and all data routes switch to the target user's context instantly and revert cleanly on exit.",
      "Admin trade editing: a Shield/Edit button on any trade detail page lets admins correct any field — ticker, type, strike, contract price, expiry, contracts, and for closed trades: close price, premium captured, P&L, and close reason.",
      "Admin stock lot editing: same admin edit button on stock detail pages covers ticker, shares, avg cost, open date, notes, and for closed lots: close price, close date, and realized P&L.",
      "Navigation modernized — the user avatar at the bottom of the sidebar is now a popover menu containing Profile & Settings, Admin Panel (admins only), theme toggle, and sign out. Removes the separate gear and theme icons from the utility strip.",
    ],
  },
  {
    date: "2026-04-23",
    version: "v2.5.2",
    highlights: [
      "Win rate on the All Accounts dashboard and Reports page is now color-coded — green when positive, red when zero, neutral dash when there's no data.",
      "Sidebar can now be collapsed to a slim icon rail, giving tables and charts full screen real estate on desktop. State persists across page loads.",
      "Sidebar controls reorganized for better usability — the collapse toggle lives in the header next to the app name, and theme/settings are now compact icon buttons at the bottom rather than full nav items.",
      "All main content pages (All Accounts, Portfolio Detail, Reports) now use the full available width — the previous max-width cap has been removed so tables and cards always fill the panel.",
    ],
  },
  {
    date: "2026-04-23",
    version: "v2.5.1",
    highlights: [
      "Portfolio tabs now remember where you left off — navigating away and back lands you on the same tab instead of resetting to Overview.",
      "All write actions (adding trades, closing positions, updating stock lots, editing portfolios) now refresh the UI immediately without needing a manual page reload.",
      "Add-to-position notes now prepend to the top and use a cleaner date-first format: Apr 23, 2026: +3x @ $1.32.",
      "Trade detail page now shows Breakeven price and live OTM/ITM status (green when out of the money, red when in the money) directly in the Details card — no need to calculate it yourself.",
      "Expiration date on trade detail now shows the full day count (e.g. 14 days) instead of shorthand, and Days Held on closed trades follows the same pattern.",
      "Removed the redundant info tooltip (ⓘ) from trade detail — the information it contained is already visible on the page.",
      "The Portfolios list page has been retired — it was largely redundant with the All Accounts dashboard and individual portfolio overviews. Navigating to /portfolios now redirects to the dashboard. The sidebar 'Portfolios' label remains as a section header with direct links to each portfolio below it.",
      "Empty state on the dashboard now has a direct 'Create Portfolio' button instead of sending you to a separate page.",
      "Insert Timestamp removed from trade and portfolio notes — the markdown format didn't export cleanly to CSV.",
    ],
  },
  {
    date: "2026-04-22",
    version: "v2.5.0",
    highlights: [
      "Major navigation overhaul (rolled up from the 2.4.x series) — the top nav bar is replaced by a persistent left sidebar with direct links to every portfolio, color-coded health dots (green/amber/red), and expiry count badges so you can read portfolio status without clicking in.",
      "Portfolio detail is now fully tabbed: Overview (the full per-portfolio dashboard with KPIs, charts, and open positions), Positions (stock lots + open trades with open premium strip), Activity (closed trade log), and Report (filtered report view scoped to this portfolio).",
      "All Accounts page gains an Overview / Report tab of its own — the standalone Reports page is retired and now lives inside the dashboard, eliminating the redundant nav item.",
      "Reports completely redesigned — stat cards match the app style, trade type badges replace plain text, a Portfolio column appears automatically when viewing all accounts, and the table is cleaner with compact dates, stacked P/L, days-held, and color-coded close reason badges.",
      "CSV export overhauled for monthly review: includes Portfolio, human-readable dates, Total P/L, % Return, Days Held, Close Reason, and Notes — all the fields that matter for a month-end review.",
      "Trade detail page rebuilt with stat cards for Strike, Avg Price, Capital/Premium, and a live ticker price that refreshes every 60 seconds and labels itself correctly as Live, Pre-Market, After Hours, or Last Close depending on market state.",
      "Adding to a position auto-logs the add (+2x @ $0.85) in the trade notes, and notes have a dedicated inline edit mode. Breadcrumbs added across portfolio, trade, and stock detail pages for easier navigation.",
    ],
  },
  {
    date: "2026-04-21",
    version: "v2.3.2",
    highlights: [
      "Full mobile overhaul — every page now works like a native app on phones, not a desktop site squeezed onto a small screen.",
      "Open Positions on the dashboard gets a dedicated mobile card layout: each position shows the ticker, type badge, DTE countdown, strike/expiry/collateral in a compact grid, and live price with OTM % at the bottom — no horizontal scrolling required.",
      "Open and Closed trade tables on the Portfolio detail page now show the correct colored type badge (CSP in blue, CC in violet) on mobile cards, matching the desktop table.",
      "All modals (Add Trade, Close Trade, Add to Position, Create Portfolio) now take full screen width on phones instead of overflowing off the edges.",
      "Page containers use tighter padding on mobile across all pages — Account Summary, Portfolios, and Reports — so content has more breathing room.",
      "Portfolio overview page has a shorter top padding on mobile so you get to the cards faster, and the color legend wraps cleanly instead of overflowing.",
      "The account selector on the dashboard stretches to full width on mobile when it wraps, making it easier to tap.",
      "Activity stats strip no longer shows broken divider lines on mobile — spacing is handled by the grid gap instead.",
      "P&L chart stat dividers (Period Total / Best / Worst) are hidden on mobile so the stats wrap cleanly without visual clutter.",
      "Stock lot detail page overhauled into a proper dashboard — shares, avg cost, cost basis, and open date are now displayed as stat cards matching the rest of the app.",
      "Each covered call row now links directly to the trade detail page — click any row to open the position.",
      "New cost basis reduction card shows the running impact of covered calls: original avg cost, current avg after premiums, total captured, and projected avg if all open CCs expire worthless.",
      "Covered call table gains a DTE countdown (color-coded amber under 21 days, red under 7) on open positions, a per-share cost reduction column showing before/after avg cost for closed CCs and the projected avg for open ones, and premium % of max captured on closed positions.",
      "Premium column is now green for profitable closes and red for losses.",
      "Stock lot notes are included in the cost basis card so all position context is in one place.",
    ],
  },
  {
    date: "2026-04-20",
    version: "v2.3.1",
    highlights: [
      "Dashboard P&L chart swapped from a cumulative area line to per-period bars — each bar is that day's (or week's, or month's) realized premium, making it immediately obvious which periods were strong and which weren't.",
      "Time period tabs expanded from MTD / 90D / YTD to six views: Daily, Weekly, Monthly, Yearly, YTD, and All Time.",
      "Activity stats promoted to a full-width strip right below the KPI cards — Win Rate, Avg Hold, Realized YTD/MTD, contracts expiring within 7 days, and next expiry date are now always visible without scrolling.",
      "New Open Positions card shows every active trade with live underlying prices, day change %, and how far each position is OTM or ITM. DTE badges are color-coded red when under 7 days and amber under 14.",
      "Dashboard layout reorganized so all actionable information — activity, positions, exposures — appears above the chart. The P&L chart moves to the bottom as a historical reference.",
      "Trade type now displays as a colored pill throughout the app: CSP in blue, CC in violet, Put in amber, Call in green. Applies to the open trades table, closed trades table, and the dashboard positions card.",
      "Table headers across all trade and stock tables refreshed — heavy gray backgrounds removed in favor of a clean separator line with uppercase muted labels, matching the dashboard style.",
      "Row hover updated from emerald tint to a neutral muted highlight for a more polished, consistent feel.",
    ],
  },
  {
    date: "2026-04-19",
    version: "v2.3.0",
    highlights: [
      "Portfolio cards now have a colored left border that gives you an instant health read — green for profitable and healthy, amber when trades are expiring soon or cash is tight, and red when you're heavily deployed or underwater.",
      "Reports page overhauled with richer insights: win rate with W/L breakdown, best and worst trade, average hold time, and a close reason summary (Expired Worthless, Assigned, Manual) all in a compact layout above the trade table.",
      "Portfolio cards show MTD P&L, YTD P&L, and average hold days. The deployment bar now displays free cash inline so you can see buying power without clicking in.",
      "Trades expiring within 7 days now surface a prominent amber alert on the portfolio card.",
      "Report table cleaned up with better row spacing, uppercase column headers, and long notes now truncate gracefully with the full text on hover.",
      "Version number on the login page now reads from the changelog automatically.",
    ],
  },
  {
    date: "2026-04-19",
    version: "v2.2.0",
    highlights: [
      "Portfolio detail page fully redesigned — KPI strip (current capital, cash available, deployed %, total P&L), secondary stats (open premium, avg P&L %, win rate, avg days, YTD), and a clean tabbed workspace for Stock Lots, Open Positions, and Closed.",
      "Stock Lots is now the first tab in portfolio detail so your largest positions are front and center.",
      "Dashboard portfolio cards now show full financial KPIs at a glance: current capital, P&L badge with trend icon, capital deployment bar, cash available, open trades count, win rate, and realized MTD.",
      "P&L chart overhauled with MTD / 90D / YTD tabs, gradient fill, hover crosshair tooltip, and period stats chips.",
      "Dashboard layout rearranged to a modern financial app feel — P&L chart promoted to the hero position with a compact KPI strip above it.",
      "Top Exposures card redesigned with a horizontal donut and inline legend. Premium by Ticker shows top 5 by default with an expand toggle.",
      "Unified table styling across Stock Lots, Open Trades, and Closed Trades — matching gray header, emerald hover rows, consistent padding, and edge-to-edge layout.",
      "Controls toolbar and pagination in trade tables now have proper breathing room from the card edges.",
      "Merged the metrics and detail-metrics API routes into one consolidated endpoint, cutting redundant database queries in half.",
      "Removed the redundant Portfolios at a Glance chips card from the dashboard.",
    ],
  },
  {
    date: "2026-04-18",
    version: "v2.1.0",
    highlights: [
      "Full visual overhaul — the app has a fresh new look with an Emerald and Amber color palette that feels modern without being overly finance-y.",
      "Light mode is cleaner and crisper with better contrast between surfaces. Amber is now used as a genuine accent rather than a washed-out tint.",
      "Dark mode has been completely reworked. Gone is the murky charcoal — it's now a crisp cool slate that makes the emerald primary really pop.",
      "Login page redesigned with a split-panel layout — branding and feature highlights on the left, clean sign-in form on the right.",
    ],
  },
  {
    date: "2026-04-18",
    version: "v1.2.0",
    highlights: [
      "Open trades now show an Allocation column so you can see at a glance how much of your total portfolio each position is tying up.",
      "The info tooltip on each trade also shows the allocation percentage alongside capital in use.",
      "Closing a position now lets you mark it as Expired Worthless or Assigned — no more entering 0.00 manually. Expired worthless captures 100% of the premium automatically.",
      "Covered calls can now be closed as assigned, which marks the linked stock lot as sold at the strike price in one step.",
      "A new Close Reason field is recorded on every trade (Manual, Expired Worthless, or Assigned) and is now a filterable column in Reports.",
      "Win Rate and Avg Days in Trade are now shown on the account summary dashboard.",
      "Open trades table now has a DTE (days to expiration) column, color-coded red when under 7 days and amber under 21.",
      "DTE and allocation % now appear on mobile trade cards too.",
      "Fixed a security issue where stock lot endpoints did not verify portfolio ownership.",
    ],
  },
  {
    date: "2026-02-12",
    version: "v1.1.4",
    highlights: [
      "Report page polish update: sortable headers, cleaner columns, and filters added for type and ticker symbol.",
      "Mobile responsiveness for reports page and other improvements",
      "Fixed assigned note to display ticker info and not the ID of the trade.",
    ],
  },
  {
    date: "2026-02-03",
    version: "v1.1.3",
    highlights: [
      "Reports now include closed stock lots alongside option trades for a complete picture.",
      "CSV exports now match what you see in the Reports table, including stock profits and total returns.",
      "Other minor reporting polish and consistency fixes.",
    ],
  },
  {
    date: "2026-01-29",
    version: "v1.1.2",
    highlights: [
      "Fixed stock lot section's dark mode to be consistent with the rest of the app.",
      "Set default sort order for open trades to be which ones are expiring soonest.",
      "Other minor updates and bug fixes.",
    ],
  },
  {
    date: "2026-01-26",
    version: "v1.1.1",
    highlights: [
      "Cleaned up the UI a bit for stock lot details page.",
      "Added the ability to sell covered calls from stock details page with pre-filled data."
    ],
  },
  {
    date: "2026-01-23",
    version: "v1.1.0",
    highlights: [
      "New stock lot feature! This will track stock lots with CC positions for more accurate metrics for PnL and capital usage.",
    ],
  },
  {
    date: "2025-10-01",
    version: "v1.0.4",
    highlights: [
      "Updated the capital card on the portfolio details page to mirror the account page for more consistency.",
    ],
  },
  {
    date: "2025-09-23",
    version: "v1.0.3",
    highlights: [
      "Updated report filter to set start date at the beginning of month for useful results.",
    ],
  },
  {
    date: "2025-09-18",
    version: "v1.0.2",
    highlights: [
      "Option profits now show correctly for every trade type — no more negative signs when you made money!",
      "Capital in use is consistent across the app: CSPs use strike collateral, and long options (puts/calls) use the premium at risk.",
      "Tooltips and the Open Positions table only show &quot;open premium&quot; when it applies (CSPs and covered calls).",
      "Account Summary totals now include puts and calls properly for accurate roll-ups.",
      "Small polish and copy tweaks for clarity."
    ],
  },
  {
    date: "2025-09-05",
    version: "v1.0.1",
    highlights: [
      "You can now switch between light and dark mode right from the login page.",
      "Fixed an issue where two different theme toggles conflicted, causing dark mode to reset. Your theme choice now saves properly between visits.",
      "Dark mode now looks consistent across the app — header, settings, and forms all match.", 
    ],
  },
  {
    date: "2025-09-04",
    version: "v1.0.0",
    highlights: [
      "Full reporting feature launched with CSV export, date range filtering, and portfolio-wide trade history.",
      "Minor bug fixes and improvements",
      "version 1.0.0 marks the first true stable release of Wheel Strat Tracker. Thank you for using the app!",
    ],
  },
  {
    date: "2025-09-03",
    version: "v0.10.2",
    highlights: [
      "Open capital, open premium, and other metrics were inaccurate when trades had been edited. This has been fixed.",
    ],
  },
  {
    date: "2025-09-01",
    version: "v0.10.1",
    highlights: [
      "The account summary page now shows richer details at a glance and feels more like a dashboard.",
      "Navigation between the summary and individual portfolios is now cleaner and more intuitive.",
      "Updated route naming for better clarity and reduce redundancy.",
    ],
  },
  {
    date: "2025-08-23",
    version: "v0.9.0",
    highlights: [
      "Trades now keep track of both original size and remaining open contracts.",
      "Closing trades now shows the correct numbers of contracts of the original trade moving forward.",
    ],
  },
  {
    date: "2025-08-20",
    version: "v0.8.0",
    highlights: [
      "Improved mobile experience for open and trade tables.",
      "Added pagination and filtering options along with other quality-of-life improvements.",
      "Introduced a changelog to track updates.",
    ],
  },
  {
    date: "2025-08-19",
    version: "v0.7.3",
    highlights: [
      "Made metrics easier to read with new detailed statistics.",
      "Improved modal usability and strengthened authentication throughout the app.",
    ],
  },
  {
    date: "2025-08-18",
    version: "v0.7.2",
    highlights: [
      "Expanded portfolio capital features with editable inputs and routes.",
      "Enhanced metrics to include cash available and capital base.",
      "Cleaned up structure and fixed favicon display issues.",
    ],
  },
  {
    date: "2025-08-16",
    version: "v0.7.1",
    highlights: [
      "Improved tooltips, user profile updates, and overall portfolio features.",
      "Refined the portfolio page layout for better readability.",
    ],
  },
  {
    date: "2025-08-15",
    version: "v0.7.0",
    highlights: [
      "Added the ability to edit trades directly from the Trade Details page.",
    ],
  },
  {
    date: "2025-08-14",
    version: "v0.6.3",
    highlights: [
      "Introduced dark mode, page animations, a mobile-friendly header, site footer, and version badge.",
      "Fixed layout issues with the footer and improved how environment and version info are displayed.",
    ],
  },
  {
    date: "2025-08-13",
    version: "v0.6.2",
    highlights: [
      "Improved dashboard cards with better reordering and responsiveness.",
    ],
  },
  {
    date: "2025-08-12",
    version: "v0.6.1",
    highlights: [
      "Enabled live updates for current capital calculations.",
      "Fixed date and timezone formatting so values display consistently.",
    ],
  },
  {
    date: "2025-08-11",
    version: "v0.6.0",
    highlights: [
      "Added the ability to add more contracts to an existing trade with a new Add-to-Trade modal.",
      "Improved spacing and layout across the trade form for a smoother experience.",
    ],
  },
  {
    date: "2025-08-09",
    version: "v0.5.1",
    highlights: [
      "Fixed issues with how metrics were calculated to ensure accuracy.",
    ],
  },
  {
    date: "2025-08-08",
    version: "v0.5.0",
    highlights: [
      "Released the new Trade Detail page with a cleaner layout and improved navigation.",
      "Refreshed dashboard and tables, reset initial data for production, and added build scripts.",
    ],
  },
  {
    date: "2025-07-31",
    version: "v0.2.0",
    highlights: ["Added app icons and branding with favicon and logo."],
  },
  {
    date: "2025-07-29",
    version: "v0.1.1",
    highlights: [
      "Enabled user sign-up and seeded production data.",
      "Fixed deployment issues on Vercel and improved base URL, cookie handling, and domain settings.",
    ],
  },
  {
    date: "2025-07-28",
    version: "v0.1.0",
    highlights: [
      "Connected portfolio metrics to the backend with working API routes.",
      "Updated branding, cleaned up unused code, and fixed deployment typing issues.",
    ],
  },
  {
    date: "2025-07-27",
    version: "v0.0.8",
    highlights: [
      "Added a metrics endpoint for closed trades and introduced the MetricsCard display component.",
    ],
  },
  {
    date: "2025-07-26",
    version: "v0.0.4",
    highlights: [
      "Added tracking for percent profit/loss on trades with refreshed sample data.",
      "Improved deletion handling for users, upgraded tables with react-table, and refined tooltips.",
      "Added the ability to close trades via a modal and API, and simplified the schema by removing unused columns.",
    ],
  },
  {
    date: "2025-07-25",
    version: "v0.0.3",
    highlights: [
      "Introduced open and closed trade tables with supporting API routes.",
      "Added a modal to create new trades and fixed currency input handling.",
      "Enabled alert dialogs and portfolio deletion features.",
    ],
  },
  {
    date: "2025-07-24",
    version: "v0.0.2",
    highlights: [
      "Added portfolio detail view with supporting API routes and data fetching.",
      "Introduced starting and current capital tracking, protected routes, and fixed session handling.",
    ],
  },
  {
    date: "2025-07-23",
    version: "v0.0.1",
    highlights: [
      "Initial launch of the app with authentication and session management.",
      "Created the first /positions page with a personalized greeting.",
    ],
  },
];

// Utility to always return sorted changelog (newest → oldest)
export function getChangelogSorted(): ChangelogEntry[] {
  return [...changelog].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

// Utility to get the latest version from the changelog
export function getLatestVersion(): string {
  const sorted = getChangelogSorted();
  return sorted[0]?.version ?? "v0.0.0";
}
