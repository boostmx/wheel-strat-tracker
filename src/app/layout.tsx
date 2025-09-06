import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trade Tracker",
  description: "Created by HL Financial Strategies",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-32x32.png",
  },
};

// Script to set initial theme before React hydration
const THEME_STORAGE_KEY = "wheeltracker.theme"; // must match ThemeProvider + toggle

const themeInit = `
(function() {
  try {
    var d = document.documentElement;
    var t = localStorage.getItem('${THEME_STORAGE_KEY}') || localStorage.getItem('theme');
    if (t === 'dark' || t === 'light') {
      d.classList.add(t);
    } else {
      // default when no preference stored
      d.classList.add('light');
    }
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="hl-theme-init"
          dangerouslySetInnerHTML={{ __html: themeInit }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-[100dvh] flex flex-col antialiased bg-muted text-gray-900 dark:bg-gray-950 dark:text-gray-100`}
      >
        {/* Make the first child of body the flex item that expands */}
        <div className="flex-1 flex flex-col">
          <AppProviders>
            <AppShell>{children}</AppShell>
          </AppProviders>
        </div>
      </body>
    </html>
  );
}
