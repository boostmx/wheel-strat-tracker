"use client";

import { ThemeProvider } from "next-themes";
import { IdleSignout } from "@/components/idle-signout";
import { Toaster, toast } from "sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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