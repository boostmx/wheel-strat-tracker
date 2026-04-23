"use client";

import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImpersonateInfo = { userId: string; username: string; name: string } | null;

export function ImpersonationBanner() {
  const router = useRouter();
  const { data: info, mutate } = useSWR<ImpersonateInfo>("/api/admin/impersonate", {
    revalidateOnFocus: false,
  });

  if (!info) return null;

  async function exit() {
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    // Immediately hide the banner, then clear all caches so sidebar and data reload as the admin
    await mutate(null, false);
    void globalMutate(() => true, undefined, { revalidate: true });
    router.push("/summary");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500 text-amber-950 text-sm font-medium flex-shrink-0">
      <div className="flex items-center gap-2">
        <UserRound className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          Viewing as <strong>@{info.username}</strong> — {info.name}
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-amber-950 hover:bg-amber-400/50 hover:text-amber-950"
        onClick={exit}
      >
        <X className="h-3.5 w-3.5 mr-1" />
        Exit
      </Button>
    </div>
  );
}
