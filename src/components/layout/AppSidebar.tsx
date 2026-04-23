"use client";

import useSWR from "swr";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Settings,
  LogOut,
  Moon,
  Sun,
  Plus,
  Menu,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CreatePortfolioModal } from "@/features/portfolios/components/CreatePortfolioModal";
import { useOverviewMetrics } from "@/features/portfolios/hooks/usePortfolioMetrics";
import type { Portfolio } from "@/types";

function usePortfolios() {
  const { data: session } = useSession();
  return useSWR<Portfolio[]>(session?.user?.id ? "/api/portfolios" : null);
}

function ThemeToggleRow() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = (theme ?? resolvedTheme) === "dark";

  function toggle() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("wheeltracker.theme", next); } catch {}
    try { document.cookie = `wheeltracker.theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch {}
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
    >
      {isDark
        ? <Sun className="h-4 w-4 flex-shrink-0" />
        : <Moon className="h-4 w-4 flex-shrink-0" />}
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </Link>
  );
}

function PortfolioItem({
  portfolio,
  active,
  onClick,
}: {
  portfolio: Portfolio;
  active: boolean;
  onClick?: () => void;
}) {
  const { data: m, isLoading } = useOverviewMetrics(portfolio.id);

  const dotColor = (() => {
    if (active) return "bg-primary";
    if (isLoading || !m) return "bg-muted-foreground/30";
    if ((m.expiringInSevenDays ?? 0) > 0 || (m.cashAvailable ?? 0) < 0)
      return "bg-amber-400";
    if ((m.percentCapitalDeployed ?? 0) >= 85 || (m.totalProfit ?? 0) < 0)
      return "bg-red-400";
    return "bg-green-500";
  })();

  return (
    <Link
      href={`/portfolios/${portfolio.id}`}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors", dotColor)} />
      <span className="truncate flex-1">{portfolio.name || "Unnamed Portfolio"}</span>
      {!isLoading && (m?.expiringInSevenDays ?? 0) > 0 && (
        <span className="flex-shrink-0 text-[10px] font-semibold bg-amber-400/20 text-amber-600 dark:text-amber-400 rounded-full px-1.5 py-0.5 leading-none">
          {m!.expiringInSevenDays}
        </span>
      )}
    </Link>
  );
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data: portfolios = [], isLoading } = usePortfolios();

  const user = session?.user;
  const initials =
    ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? ""))
      .toUpperCase() || "U";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand */}
      <div className="px-3 py-4 flex-shrink-0">
        <Link
          href="/summary"
          onClick={onNavigate}
          className="flex items-center gap-2.5"
        >
          <Image
            src="/logo.png"
            alt="HL Financial Strategies"
            width={28}
            height={28}
          />
          <span className="font-semibold text-sm text-foreground leading-tight">
            Wheel Trade Tracker
          </span>
        </Link>
      </div>

      <Separator className="flex-shrink-0" />

      {/* Main nav */}
      <div className="px-2 py-3 space-y-0.5 flex-shrink-0">
        <NavItem
          href="/summary"
          icon={LayoutDashboard}
          label="All Accounts"
          active={pathname === "/summary"}
          onClick={onNavigate}
        />
      </div>

      <Separator className="flex-shrink-0" />

      {/* Portfolios — scrollable region */}
      <div className="px-2 py-3 flex-1 overflow-y-auto min-h-0">
        <div className="flex items-center gap-1 mb-2">
          <Link
            href="/portfolios"
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2 flex-1 rounded-md text-sm font-medium transition-colors",
              pathname === "/portfolios"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Briefcase className="h-4 w-4 flex-shrink-0" />
            Portfolios
          </Link>
          <CreatePortfolioModal
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="New portfolio"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            }
          />
        </div>

        <div className="space-y-0.5">
          {isLoading ? (
            <>
              <div className="h-7 mx-1 rounded-md bg-accent/30 animate-pulse" />
              <div className="h-7 mx-1 rounded-md bg-accent/30 animate-pulse opacity-60" />
            </>
          ) : portfolios.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-1">
              No portfolios yet
            </p>
          ) : (
            portfolios.map((p) => (
              <PortfolioItem
                key={p.id}
                portfolio={p}
                active={pathname.startsWith(`/portfolios/${p.id}`)}
                onClick={onNavigate}
              />
            ))
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <Separator className="flex-shrink-0" />
      <div className="px-2 py-3 space-y-0.5 flex-shrink-0">
        <NavItem
          href="/settings"
          icon={Settings}
          label="Settings"
          active={pathname === "/settings"}
          onClick={onNavigate}
        />
        <ThemeToggleRow />
      </div>

      {/* User row */}
      {user?.username && (
        <>
          <Separator className="flex-shrink-0" />
          <div className="px-3 py-3 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt="avatar"
                    className="h-7 w-7 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-emerald-500 text-white grid place-items-center text-xs font-semibold flex-shrink-0">
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{user.username}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col bg-background border-r border-border flex-shrink-0 overflow-hidden">
      <NavContent />
    </aside>
  );
}

export function MobileTopBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-background flex-shrink-0">
      <Link href="/summary" className="flex items-center gap-2">
        <Image
          src="/logo.png"
          alt="HL Financial Strategies"
          width={26}
          height={26}
        />
        <span className="font-semibold text-sm text-foreground">
          Wheel Trade Tracker
        </span>
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <NavContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
