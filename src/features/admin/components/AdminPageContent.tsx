"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { Shield, UserRound, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  _count: { portfolios: number };
};

const TABS = ["Users"] as const;
type Tab = (typeof TABS)[number];

function UsersTab({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const { data: users, mutate } = useSWR<AdminUser[]>("/api/admin/users");
  const [actionId, setActionId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  async function toggleAdmin(userId: string, newValue: boolean) {
    setActionId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: newValue }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await mutate();
      toast.success(newValue ? "Admin access granted" : "Admin access removed");
    } catch (e) {
      toast.error((e as Error).message || "Failed to update user");
    } finally {
      setActionId(null);
    }
  }

  async function impersonate(userId: string) {
    setActionId(userId);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      void globalMutate(() => true, undefined, { revalidate: true });
      router.push("/summary");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "Failed to impersonate user");
      setActionId(null);
    }
  }

  async function resetPassword() {
    if (!resetTarget) return;
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setActionId(resetTarget.id);
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`Password reset for @${resetTarget.username}`);
      setResetTarget(null);
      setNewPassword("");
    } catch (e) {
      toast.error((e as Error).message || "Failed to reset password");
    } finally {
      setActionId(null);
    }
  }

  async function deleteUser() {
    if (!deleteTarget) return;
    setActionId(deleteTarget.id);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`@${deleteTarget.username} and all their data deleted`);
      setDeleteTarget(null);
      await mutate();
    } catch (e) {
      toast.error((e as Error).message || "Failed to delete user");
    } finally {
      setActionId(null);
    }
  }

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden">
        {!users ? (
          <div className="px-6 py-12 text-sm text-muted-foreground text-center">Loading users…</div>
        ) : (
          <div className="divide-y">
            {users.map((u) => (
              <div key={u.id} className="px-6 py-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-emerald-500 text-white grid place-items-center text-sm font-semibold flex-shrink-0">
                  {(u.firstName[0] + u.lastName[0]).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {u.firstName} {u.lastName}
                    </p>
                    {u.isAdmin && (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                        <Shield className="h-2.5 w-2.5" />
                        Admin
                      </Badge>
                    )}
                    {u.id === currentUserId && (
                      <span className="text-[10px] text-muted-foreground">(you)</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    @{u.username} · {u.email}
                  </p>
                </div>

                <div className="hidden sm:flex flex-col items-end gap-0.5 text-xs text-muted-foreground flex-shrink-0">
                  <span>{u._count.portfolios} {u._count.portfolios === 1 ? "portfolio" : "portfolios"}</span>
                  <span>Joined {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                </div>

                <div className={cn("flex items-center gap-1 flex-shrink-0", u.id === currentUserId && "opacity-40 pointer-events-none")}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title={`View as @${u.username}`}
                    disabled={!!actionId}
                    onClick={() => impersonate(u.id)}
                  >
                    <UserRound className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title="Reset password"
                    disabled={!!actionId}
                    onClick={() => { setResetTarget(u); setNewPassword(""); }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={u.isAdmin ? "outline" : "secondary"}
                    size="sm"
                    className="h-8 text-xs px-2.5"
                    disabled={!!actionId}
                    onClick={() => toggleAdmin(u.id, !u.isAdmin)}
                  >
                    {u.isAdmin ? "Remove Admin" : "Make Admin"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="Delete user"
                    disabled={!!actionId}
                    onClick={() => setDeleteTarget(u)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset password dialog */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-xl border shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold">Reset password for @{resetTarget.username}</h3>
            <div className="space-y-1.5">
              <Label htmlFor="newPwAdmin">New password</Label>
              <Input
                id="newPwAdmin"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && resetPassword()}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setResetTarget(null)}>Cancel</Button>
              <Button disabled={actionId === resetTarget.id} onClick={resetPassword}>
                {actionId === resetTarget.id ? "Saving…" : "Reset Password"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-xl border shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold">Delete @{deleteTarget.username}?</h3>
            <p className="text-sm text-muted-foreground">
              This will permanently delete <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong> and all{" "}
              {deleteTarget._count.portfolios} of their portfolios, trades, and positions. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={actionId === deleteTarget.id}
                onClick={deleteUser}
              >
                {actionId === deleteTarget.id ? "Deleting…" : "Delete permanently"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminPageContent() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("Users");
  const currentUserId = session?.user?.id ?? "";

  return (
    <div className="py-6 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold">Admin</h1>
            <Badge className="text-[10px] px-1.5 py-0 h-5 gap-1">
              <Shield className="h-3 w-3" />
              Admin
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Manage users and application access.</p>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Users" && <UsersTab currentUserId={currentUserId} />}
    </div>
  );
}
