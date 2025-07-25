"use client";

import { usePathname } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import { SiteHeader } from "@/components/site-header";
import { SWRConfig } from "swr";

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
      {showHeader && <SiteHeader />}
      {children}
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
