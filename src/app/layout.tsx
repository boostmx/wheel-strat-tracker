import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AppSessionProvider } from "@/components/session-provider"

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
  title: "Wheel Strategy Tracker",
  description: "Created by HL Financial Strategies",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children} 
        <AppSessionProvider>
          {children}
          <Toaster richColors position="top-center" />
        </AppSessionProvider>
      </body>
    </html>
  )
}
