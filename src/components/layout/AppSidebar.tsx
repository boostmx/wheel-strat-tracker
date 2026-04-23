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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreatePortfolioModal } from "@/features/portfolios/components/CreatePortfolioModal";
import { useOverviewMetrics } from "@/features/portfolios/hooks/usePortfolioMetrics";
import { VersionBadge } from "@/components/layout/VersionBadge";
import type { Portfolio } from "@/types";

const COLLAPSED_KEY = "wheeltracker.sidebar.collapsed";

function usePortfolios() {
  const { data: session } = useSession();
  return useSWR<Portfolio[]>(session?.user?.id ? "/api/portfolios" : null);
}

function WithTooltip({
  label,
  children,
  enabled,
}: {
  label: string;
  children: React.ReactNode;
  enabled: boolean;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ThemeIconButton() {
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

  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Light mode" : "Dark mode";

  return (
    <WithTooltip label={label} enabled>
      <button
        onClick={toggle}
        className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors flex-shrink-0"
      >
        <Icon className="h-4 w-4" />
      </button>
    </WithTooltip>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  onClick,
  collapsed,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick?: () => void;
  collapsed: boolean;
}) {
  const cls = cn(
    "flex items-center w-full rounded-md text-sm font-medium transition-colors",
    active
      ? "bg-accent text-accent-foreground"
      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
    collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2"
  );

  return (
    <WithTooltip label={label} enabled={collapsed}>
      <Link href={href} onClick={onClick} className={cls}>
        <Icon className="h-4 w-4 flex-shrink-0" />
        {!collapsed && label}
      </Link>
    </WithTooltip>
  );
}

function PortfolioItem({
  portfolio,
  active,
  onClick,
  collapsed,
}: {
  portfolio: Portfolio;
  active: boolean;
  onClick?: () => void;
  collapsed: boolean;
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

  const expiringCount = m?.expiringInSevenDays ?? 0;

  if (collapsed) {
    return (
      <WithTooltip
        label={`${portfolio.name || "Unnamed Portfolio"}${expiringCount > 0 ? ` · ${expiringCount} expiring` : ""}`}
        enabled
      >
        <Link
          href={`/portfolios/${portfolio.id}`}
          onClick={onClick}
          className={cn(
            "flex justify-center items-center py-2 rounded-md transition-colors",
            active
              ? "bg-accent"
              : "hover:bg-accent/50"
          )}
        >
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0 transition-colors", dotColor)} />
        </Link>
      </WithTooltip>
    );
  }

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
      {!isLoading && expiringCount > 0 && (
        <span className="flex-shrink-0 text-[10px] font-semibold bg-amber-400/20 text-amber-600 dark:text-amber-400 rounded-full px-1.5 py-0.5 leading-none">
          {expiringCount}
        </span>
      )}
    </Link>
  );
}

function NavContent({
  onNavigate,
  collapsed,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
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
      <div className={cn(
        "flex items-center flex-shrink-0 py-3",
        collapsed ? "justify-center px-0 py-4" : "pl-3 pr-2"
      )}>
        <Link
          href="/summary"
          onClick={onNavigate}
          className={cn("flex items-center gap-2.5", !collapsed && "flex-1 min-w-0")}
        >
          <Image
            src="/logo.png"
            alt="HL Financial Strategies"
            width={28}
            height={28}
            className="flex-shrink-0"
          />
          {!collapsed && (
            <span className="font-semibold text-sm text-foreground leading-tight whitespace-nowrap">
              Wheel Trade Tracker
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="ml-1 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/50 hover:bg-accent hover:text-foreground transition-colors flex-shrink-0"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Separator className="flex-shrink-0" />

      {/* Main nav */}
      <div className={cn("py-3 space-y-0.5 flex-shrink-0", collapsed ? "px-1.5" : "px-2")}>
        <NavItem
          href="/summary"
          icon={LayoutDashboard}
          label="All Accounts"
          active={pathname === "/summary"}
          onClick={onNavigate}
          collapsed={collapsed}
        />
      </div>

      <Separator className="flex-shrink-0" />

      {/* Portfolios — scrollable region */}
      <div className={cn("py-3 flex-1 overflow-y-auto min-h-0", collapsed ? "px-1.5" : "px-2")}>
        {collapsed ? (
          <WithTooltip label="Portfolios" enabled>
            <div className="flex justify-center py-2 text-muted-foreground">
              <Briefcase className="h-4 w-4" />
            </div>
          </WithTooltip>
        ) : (
          <div className="flex items-center gap-1 mb-2">
            <div className="flex items-center gap-3 px-3 py-2 flex-1 rounded-md text-sm font-medium text-muted-foreground">
              <Briefcase className="h-4 w-4 flex-shrink-0" />
              Portfolios
            </div>
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
        )}

        <div className="space-y-0.5">
          {isLoading ? (
            <>
              <div className="h-7 mx-1 rounded-md bg-accent/30 animate-pulse" />
              <div className="h-7 mx-1 rounded-md bg-accent/30 animate-pulse opacity-60" />
            </>
          ) : portfolios.length === 0 ? (
            !collapsed && (
              <p className="text-xs text-muted-foreground px-3 py-1">
                No portfolios yet
              </p>
            )
          ) : (
            portfolios.map((p) => (
              <PortfolioItem
                key={p.id}
                portfolio={p}
                active={pathname.startsWith(`/portfolios/${p.id}`)}
                onClick={onNavigate}
                collapsed={collapsed}
              />
            ))
          )}
        </div>
      </div>

      {/* Utility strip — theme, settings, expand (collapsed only) */}
      <Separator className="flex-shrink-0" />
      <div className={cn(
        "flex flex-shrink-0 py-1.5",
        collapsed ? "flex-col items-center gap-0.5 px-1.5" : "flex-row items-center gap-0.5 px-2"
      )}>
        <ThemeIconButton />
        <WithTooltip label="Settings" enabled={collapsed}>
          <Link
            href="/settings"
            onClick={onNavigate}
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-md transition-colors flex-shrink-0",
              pathname === "/settings"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
          </Link>
        </WithTooltip>
        {collapsed && (
          <WithTooltip label="Expand sidebar" enabled>
            <button
              onClick={onToggleCollapse}
              className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </WithTooltip>
        )}
      </div>

      {/* User row */}
      {user?.username && (
        <>
          <Separator className="flex-shrink-0" />
          <div className={cn("py-3 flex-shrink-0", collapsed ? "flex justify-center" : "px-3")}>
            {collapsed ? (
              <WithTooltip label={`${user.firstName} ${user.lastName} (@${user.username})`} enabled>
                <div>
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      alt="avatar"
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-emerald-500 text-white grid place-items-center text-xs font-semibold">
                      {initials}
                    </div>
                  )}
                </div>
              </WithTooltip>
            ) : (
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
            )}
          </div>
        </>
      )}

      {/* Footer — version + copyright */}
      {!collapsed && (
        <div className="px-3 py-2.5 flex-shrink-0 flex items-center justify-between">
          <Link
            href="/changelog"
            onClick={onNavigate}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <VersionBadge />
          </Link>
          <span className="text-[10px] text-muted-foreground/40">
            © {new Date().getFullYear()} HLF
          </span>
        </div>
      )}
    </div>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
    } catch {}
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
  }

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col bg-background border-r border-border flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
        collapsed ? "md:w-14" : "md:w-60"
      )}
    >
      <NavContent
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />
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
          <NavContent
            onNavigate={() => setOpen(false)}
            collapsed={false}
            onToggleCollapse={() => {}}
          />
        </SheetContent>
      </Sheet>
    </header>
  );
}
