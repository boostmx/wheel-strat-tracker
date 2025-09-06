"use client";

import { ThemeProvider } from "next-themes";
import { IdleSignout } from "@/features/auth/components/IdleSignout";
import { Toaster, toast } from "sonner";
import ThemeCookieSync from "./layout/ThemeCookieSync";

const THEME_STORAGE_KEY = "wheeltracker.theme";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      storageKey={THEME_STORAGE_KEY}
      enableSystem={false}
      disableTransitionOnChange
      themes={["light", "dark"]}
    >
      <ThemeCookieSync />
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
