export interface ChangelogEntry {
  date: string; // e.g. "2025-08-20"
  version?: string; // e.g. "v0.8.0"
  highlights: string[];
}

export const changelog: ChangelogEntry[] = [
    {
        date: "2025-08-23",
        version: "v0.9.0",
        highlights: [
            "Trades now keep track of both original size and remaining open contracts.",
            "Closing trades now shows the correct numbers of contracts of the original trade moving forward.",
        ]
    },
    {
        date: "2025-08-20",
        version: "v0.8.0",
        highlights: [
            "Improved mobile experience for open and trade tables.",
            "Added pagination and filtering options along with other quality-of-life improvements.",
            "Introduced a changelog to track updates."
        ]
    },
    {
        date: "2025-08-19",
        version: "v0.7.3",
        highlights: [
            "Made metrics easier to read with new detailed statistics.",
            "Improved modal usability and strengthened authentication throughout the app."
        ]
    },
    {
        date: "2025-08-18",
        version: "v0.7.2",
        highlights: [
            "Expanded portfolio capital features with editable inputs and routes.",
            "Enhanced metrics to include cash available and capital base.",
            "Cleaned up structure and fixed favicon display issues."
        ]
    },
    {
        date: "2025-08-16",
        version: "v0.7.1",
        highlights: [
            "Improved tooltips, user profile updates, and overall portfolio features.",
            "Refined the portfolio page layout for better readability."
        ]
    },
    {
        date: "2025-08-15",
        version: "v0.7.0",
        highlights: [
            "Added the ability to edit trades directly from the Trade Details page."
        ]
    },
    {
        date: "2025-08-14",
        version: "v0.6.3",
        highlights: [
            "Introduced dark mode, page animations, a mobile-friendly header, site footer, and version badge.",
            "Fixed layout issues with the footer and improved how environment and version info are displayed."
        ]
    },
    {
        date: "2025-08-13",
        version: "v0.6.2",
        highlights: [
            "Improved dashboard cards with better reordering and responsiveness."
        ]
    },
    {
        date: "2025-08-12",
        version: "v0.6.1",
        highlights: [
            "Enabled live updates for current capital calculations.",
            "Fixed date and timezone formatting so values display consistently."
        ]
    },
    {
        date: "2025-08-11",
        version: "v0.6.0",
        highlights: [
            "Added the ability to add more contracts to an existing trade with a new Add-to-Trade modal.",
            "Improved spacing and layout across the trade form for a smoother experience."
        ]
    },
    {
        date: "2025-08-09",
        version: "v0.5.1",
        highlights: [
            "Fixed issues with how metrics were calculated to ensure accuracy."
        ]
    },
    {
        date: "2025-08-08",
        version: "v0.5.0",
        highlights: [
            "Released the new Trade Detail page with a cleaner layout and improved navigation.",
            "Refreshed dashboard and tables, reset initial data for production, and added build scripts."
        ]
    },
    {
        date: "2025-07-31",
        version: "v0.2.0",
        highlights: [
            "Added app icons and branding with favicon and logo."
        ]
    },
    {
        date: "2025-07-29",
        version: "v0.1.1",
        highlights: [
            "Enabled user sign-up and seeded production data.",
            "Fixed deployment issues on Vercel and improved base URL, cookie handling, and domain settings."
        ]
    },
    {
        date: "2025-07-28",
        version: "v0.1.0",
        highlights: [
            "Connected portfolio metrics to the backend with working API routes.",
            "Updated branding, cleaned up unused code, and fixed deployment typing issues."
        ]
    },
    {
        date: "2025-07-27",
        version: "v0.0.8",
        highlights: [
            "Added a metrics endpoint for closed trades and introduced the MetricsCard display component."
        ]
    },
    {
        date: "2025-07-26",
        version: "v0.0.4",
        highlights: [
            "Added tracking for percent profit/loss on trades with refreshed sample data.",
            "Improved deletion handling for users, upgraded tables with react-table, and refined tooltips.",
            "Added the ability to close trades via a modal and API, and simplified the schema by removing unused columns."
        ]
    },
    {
        date: "2025-07-25",
        version: "v0.0.3",
        highlights: [
            "Introduced open and closed trade tables with supporting API routes.",
            "Added a modal to create new trades and fixed currency input handling.",
            "Enabled alert dialogs and portfolio deletion features."
        ]
    },
    {
        date: "2025-07-24",
        version: "v0.0.2",
        highlights: [
            "Added portfolio detail view with supporting API routes and data fetching.",
            "Introduced starting and current capital tracking, protected routes, and fixed session handling."
        ]
    },
    {
        date: "2025-07-23",
        version: "v0.0.1",
        highlights: [
            "Initial launch of the app with authentication and session management.",
            "Created the first /positions page with a personalized greeting."
        ]
    }
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
