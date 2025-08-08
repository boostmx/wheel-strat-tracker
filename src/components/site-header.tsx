"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  return (
    <header className="w-full border-b px-6 py-4 flex items-center justify-between bg-white shadow-sm">
      {/* Left: Logo and Nav */}
      <div className="flex items-center gap-6">
        {/* Logo + Business Name */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="HL Financial Strategies"
            width={32}
            height={32}
          />
          <span className="text-lg font-semibold text-gray-800">
            HL Financial Strategies
          </span>
        </Link>

        {/* Navigation Links */}
        {session && (
          <nav className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition"
            >
              Portfolios
            </Link>
            <Link
              href="/metrics"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition"
            >
              Metrics
            </Link>
            {/* Add more nav items here as needed */}
          </nav>
        )}
      </div>

      {/* Right: Session Controls */}
      <div className="flex items-center space-x-4">
        {session?.user?.username && (
          <span className="text-sm text-gray-600">
            Hi, <strong>{session.user.firstName}</strong>
          </span>
        )}
        {session && (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded border"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}