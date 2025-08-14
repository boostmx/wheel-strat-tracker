// src/components/site-header.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Menu, LogOut, ChevronRight } from "lucide-react";
import { VersionBadge } from "./version-badge";

export function SiteHeader() {
  const { data: session } = useSession();
  const userName = session?.user?.firstName ?? "User";

  // Inline nav links (desktop)
  const NavLinks = () => (
    <nav className="hidden md:flex items-center gap-4 text-sm">
      <Link
        href="/overview"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        Overview
      </Link>
      <Link
        href="/summary"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        Account Summary
      </Link>
    </nav>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Left: Brand and nav */}
        <div className="flex items-center gap-2">
          <Link href="/overview" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="HL Financial Strategies"
              width={24}
              height={24}
              className="opacity-90 dark:opacity-100"
            />
            <span className="font-semibold tracking-tight text-foreground">
              Trade Tracker
            </span>
          </Link>
          <div className="ml-4">
            <NavLinks />
          </div>
        </div>

        {/* Right: actions (desktop) */}
        <div className="hidden md:flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Hi, <span className="font-medium text-foreground">{userName}</span>
          </span>
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>

        {/* Mobile: hamburger */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Image
                    src="/logo.png"
                    alt="HL Financial Strategies"
                    width={20}
                    height={20}
                    className="opacity-90 dark:opacity-100"
                  />
                  Trade Tracker
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Hi, <span className="font-medium text-foreground">{userName}</span>
                </div>
                <ThemeToggle />
              </div>

              <Separator className="my-4" />

              {/* Mobile nav links */}
              <nav className="grid gap-1">
                <SheetClose asChild>
                  <Link
                    href="/overview"
                    className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    Overview <ChevronRight className="h-4 w-4 opacity-60" />
                  </Link>
                </SheetClose>

                <SheetClose asChild>
                  <Link
                    href="/summary"
                    className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    Account Summary{" "}
                    <ChevronRight className="h-4 w-4 opacity-60" />
                  </Link>
                </SheetClose>
              </nav>

              <Separator className="my-4" />

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </div>            
              <div className="flex justify-center text-center text-xs text-muted-foreground mt-4 italic">
                <VersionBadge className="" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}