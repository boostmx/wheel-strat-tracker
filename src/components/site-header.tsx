"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  return (
    <header className="w-full border-b px-6 py-4 flex items-center justify-between bg-white shadow-sm">
      {/* Logo and Business Name */}
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo.png" alt="HL Financial Strategies" width={32} height={32} />
          <span className="text-lg font-semibold text-gray-800">HL Financial Strategies</span>
        </Link>
      </div>

      {/* Session Controls */}
      <div className="flex items-center space-x-4">
        {session?.user?.username && (
          <span className="text-sm text-gray-600">
            Hi, <strong>{session.user.firstName}</strong>
          </span>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded border"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
