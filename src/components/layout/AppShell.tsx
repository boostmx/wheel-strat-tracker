"use client";

import { usePathname } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import { SWRConfig } from "swr";
import { AppSidebar, MobileTopBar } from "@/components/layout/AppSidebar";

function InnerShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const hideChrome = ["/", "/login", "/signup"];
  const showChrome = session && !hideChrome.includes(pathname);

  return (
    <SWRConfig
      value={{
        fetcher: (url: string) => fetch(url).then((res) => res.json()),
        shouldRetryOnError: false,
      }}
    >
      {showChrome ? (
        <div className="flex h-[100dvh] overflow-hidden">
          {/* Desktop sidebar */}
          <AppSidebar />
          {/* Content column */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Mobile top bar — hidden on md+ */}
            <div className="md:hidden">
              <MobileTopBar />
            </div>
            <main className="flex-1 overflow-y-auto bg-muted dark:bg-gray-950">
              {children}
            </main>
          </div>
        </div>
      ) : (
        <div className="min-h-[100dvh] flex flex-col">
          <main className="flex-1">{children}</main>
        </div>
      )}
    </SWRConfig>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <InnerShell>{children}</InnerShell>
    </SessionProvider>
  );
}
