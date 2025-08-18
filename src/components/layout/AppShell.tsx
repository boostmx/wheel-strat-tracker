"use client";

import { usePathname } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SWRConfig } from "swr";
import { SiteFooter } from "@/components/layout/SiteFooter";

function InnerShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const hideHeaderRoutes = ["/", "/login"];
  const showHeader = session && !hideHeaderRoutes.includes(pathname);

  return (
    <SWRConfig
      value={{
        fetcher: (url: string) => fetch(url).then((res) => res.json()),
        shouldRetryOnError: false,
      }}
    >
      <div className="min-h-[100dvh] flex flex-col">
        {showHeader && <SiteHeader />}
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </SWRConfig>
  );
}

// 👇 This wraps the whole app in SessionProvider
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <InnerShell>{children}</InnerShell>
    </SessionProvider>
  );
}
