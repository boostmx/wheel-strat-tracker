"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Moon, Sun, Settings, LogOut, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const STORAGE_KEY = "wheeltracker.theme" as const;
  const current = (theme ?? resolvedTheme) as "light" | "dark" | undefined;
  const isDark = current === "dark";
  const nextTheme = isDark ? "light" : "dark";

  function persist(value: "light" | "dark"): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {}
    try {
      document.cookie = `${STORAGE_KEY}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {}
  }

  function toggle() {
    setTheme(nextTheme); // updates <html class> via next-themes
    persist(nextTheme); // ensure persistence across refresh / SSR
  }

  return (
    <button
      onClick={toggle}
      className="text-sm w-full text-left flex items-center gap-2"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      type="button"
    >
      {isDark ? (
        <>
          <Sun className="w-4 h-4" />
          Light mode
        </>
      ) : (
        <>
          <Moon className="w-4 h-4" />
          Dark mode
        </>
      )}
    </button>
  );
}

export function SiteHeader() {
  const { data: session, status } = useSession();
  if (status === "loading") return null;

  const user = session?.user;
  const initials =
    (user?.firstName?.[0] || "")
      .concat(user?.lastName?.[0] || "")
      .toUpperCase() || "U";

  return (
    <header className="w-full border-b border-border px-6 py-4 flex items-center justify-between bg-background shadow-sm">
      {/* Left: logo + desktop nav */}
      <div className="hidden md:flex items-center gap-6">
        <Link href="/summary" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="HL Financial Strategies"
            width={32}
            height={32}
          />
          <span className="text-lg font-semibold text-foreground">
            Trade Tracker
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/summary"
            className="text-sm text-foreground hover:underline"
          >
            Account
          </Link>
          <Link
            href="/portfolios"
            className="text-sm text-foreground hover:underline"
          >
            Portfolios
          </Link>
          <Link
            href="/reports"
            className="text-sm text-foreground hover:underline"
          >
            Reports
          </Link>
        </nav>
      </div>

      {/* Left (mobile): logo only */}
      <div className="md:hidden flex items-center gap-2">
        <Link href="/summary" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="HL Financial Strategies"
            width={28}
            height={28}
          />
          <span className="text-base font-semibold text-foreground">
            Trade Tracker
          </span>
        </Link>
      </div>

      <div className="flex items-center space-x-4">
        {/* Mobile: single hamburger menu with nav + account */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="md:hidden p-2"
              aria-label="Open navigation and menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 md:hidden">
            {/* Nav first */}
            <DropdownMenuItem asChild>
              <Link href="/summary">Account</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/portfolios">Portfolios</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/reports">Reports</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Account actions */}
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ThemeToggle />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* User details at the bottom */}
            {user?.username && (
              <>
                <DropdownMenuLabel>
                  <div className="flex items-center gap-3">
                    {user?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.image}
                        alt="avatar"
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-emerald-500 text-white grid place-items-center text-xs font-semibold">
                        {initials}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{user.username}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut({ callbackUrl: "/login" });
                  }}
                  className="flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {user?.username && (
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  {user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      alt="avatar"
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-emerald-500 text-white grid place-items-center text-xs font-semibold">
                      {initials}
                    </div>
                  )}
                  <span className="text-sm text-foreground hidden sm:inline">
                    {user.firstName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      @{user.username}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ThemeToggle />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut({ callbackUrl: "/login" });
                  }}
                  className="flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
}
