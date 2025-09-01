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
const script = `
(function() {
  try {
    var t = localStorage.getItem('wheeltracker.theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.classList.toggle('dark', t === 'dark');
    }
  } catch (e) {}
})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: script }} />
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
