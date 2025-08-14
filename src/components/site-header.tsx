"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  return (
    <header className="w-full border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between bg-white dark:bg-gray-900/60 shadow-sm">
      {/* Left: Logo and Nav */}
      <div className="flex items-center gap-6">
        {/* Logo + Business Name */}
        <Link href="/overview" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="HL Financial Strategies"
            width={32}
            height={32}
          />
          <span className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Trade Tracker
          </span>
        </Link>

        {/* Navigation Links */}
        {session && (
          <nav className="flex items-center gap-4">
            <Link
              href="/overview"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition"
            >
              Portfolios
            </Link>
            <Link
              href="/summary"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition"
            >
              Account Summary
            </Link>
            {/* Add more nav items here as needed */}
          </nav>
        )}
      </div>

      {/* Right: Session Controls */}
      <div className="flex items-center gap-3">
        {session?.user?.username && (
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Hi, <strong>{session.user.firstName}</strong>
          </span>
        )}
        <ThemeToggle />
        {session && (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100 rounded border"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
