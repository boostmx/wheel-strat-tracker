import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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