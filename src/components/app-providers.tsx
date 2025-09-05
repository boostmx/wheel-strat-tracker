"use client";

import { ThemeProvider } from "next-themes";
import { IdleSignout } from "@/features/auth/components/IdleSignout";
import { Toaster, toast } from "sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class" // adds/removes 'dark' class on <html>
      defaultTheme="system" // or "light" if you prefer
      enableSystem // respect OS theme
      storageKey="wheeltracker.theme" // optional, but makes it explicit/stable
      disableTransitionOnChange // prevents color-flash
    >
      {/* Idle sign-out: 30 min total; warn at T-1 min */}
      <IdleSignout
        timeoutMs={30 * 60 * 1000} // 30 minutes
        warnMs={60 * 1000} // 1 minute
        onWarn={() => toast("Auto sign-out in 1 minute due to inactivity")}
      />
      {children}
      <Toaster richColors position="top-center" />
    </ThemeProvider>
  );
}
