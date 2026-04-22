export interface ChangelogEntry {
  date: string; // e.g. "2025-08-20"
  version?: string; // e.g. "v0.8.0"
  highlights: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-04-22",
    version: "v2.4.3",
    highlights: [
      "Replaced the top navigation bar with a persistent left sidebar — click directly into any portfolio from anywhere in the app without going through the overview page first.",
      "Portfolio health dots in the sidebar show green, amber, or red at a glance based on deployment level, expiring trades, and P&L — no need to open a portfolio to know its status.",
    ],
  },
  {
    date: "2026-04-22",
    version: "v2.4.2",
    highlights: [
      "Closed trades table cleaned up — the messy Details column is replaced with separate Strike/Cost and Qty columns; P/L and % P/L are merged into a single column showing dollar amount with percentage below.",
      "Trade detail page for closed positions now shows the close price as a primary stat card alongside the avg open price, making it easy to see exactly what you received vs. what you paid to close. Expiration date added to the details section.",
      "Live stock price added to the Open Positions table on the portfolio detail page — shows current price with day change % and a color-coded OTM % column so you can see at a glance how far each option is from being in the money.",
      "Stock lots table expanded to full width on the portfolio detail page with two new columns: Live Price (with day change %) and Unrealized P/L (dollar and percent) so you can track your share positions alongside your options.",
      "Performance stats (Win Rate, Avg P/L, Open Premium, etc.) moved from a side card to a compact horizontal strip, giving the stock lots table full width to breathe.",
      "Dashboard P&L bar chart hover fixed — the highlighted bar now correctly tracks the cursor position using the SVG coordinate matrix instead of a manual screen-to-viewBox calculation.",
      "Daily P&L chart defaults to the current month (MTD) instead of 90 days — a new MTD / 30d / 90d sub-filter appears when on the Daily tab so you can expand the window when needed.",
      "Modal UI updates for a cleaner, more consistent look across the app"
    ],
  },
  {
    date: "2026-04-22",
    version: "v2.4.0",
    highlights: [
      "Trade detail page fully redesigned — primary stats (Strike, Avg Price, Capital In Use or Premium Captured) each get their own prominent card, while secondary info (Contracts, Expiry, DTE, Opened, Days Held, Close Reason) is consolidated into a clean Details card.",
      "Trade type badges are now color-coded on the trade detail page: Covered Calls in violet, Cash-Secured Puts in blue, Calls in green, Puts in amber — consistent with the rest of the app.",
      "Adding to a position now automatically appends a log entry to the trade notes (e.g. +2x @ $0.85 — Apr 22, 2026) so your add history is captured without any manual steps. Edit the note afterwards if you want to add context.",
      "Notes card on the trade detail page has a dedicated header with an Edit button in the top right — clicking it opens inline editing without disrupting the rest of the page.",
      "Live ticker price now appears as a fourth primary stat card on the trade detail page, refreshing every 60 seconds.",
      "Live ticker price also appears in the stock lot detail stat cards, showing the current price alongside your avg cost and cost basis.",
      "When the market is closed, the price card label updates automatically to Last Close, Pre-Market, or After Hours instead of Live Price — applies to the trade detail, stock lot detail, and the dashboard Open Positions table.",
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
