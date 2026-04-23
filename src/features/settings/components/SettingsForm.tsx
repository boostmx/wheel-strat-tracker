"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import useSWR from "swr";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, Shield } from "lucide-react";
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

type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  bio: string | null;
  isAdmin: boolean;
  createdAt: string;
};

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function AdminPanel({ currentUserId }: { currentUserId: string }) {
  const { data: users, mutate } = useSWR<AdminUser[]>("/api/admin/users");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleAdmin(userId: string, newValue: boolean) {
    setTogglingId(userId);
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
      setTogglingId(null);
    }
  }

  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">User Management</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            All registered users and their access level.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs mt-0.5">Admin</Badge>
      </div>

      {!users ? (
        <div className="px-6 py-8 text-sm text-muted-foreground text-center">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="px-6 py-8 text-sm text-muted-foreground text-center">No users found.</div>
      ) : (
        <div className="divide-y">
          {users.map((u) => (
            <div key={u.id} className="px-6 py-3.5 flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-emerald-500 text-white grid place-items-center text-xs font-semibold flex-shrink-0">
                {(u.firstName[0] + u.lastName[0]).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight">
                  {u.firstName} {u.lastName}
                  {u.id === currentUserId && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">(you)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{u.username} · {u.email}
                </p>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-0.5 text-xs text-muted-foreground flex-shrink-0">
                <span>
                  {u._count.portfolios} {u._count.portfolios === 1 ? "portfolio" : "portfolios"}
                </span>
                <span>
                  Joined {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </span>
              </div>
              <div className="flex-shrink-0">
                {u.id === currentUserId ? (
                  <Badge className="text-xs">Admin</Badge>
                ) : (
                  <Button
                    variant={u.isAdmin ? "outline" : "secondary"}
                    size="sm"
                    className="h-7 text-xs"
                    disabled={togglingId === u.id}
                    onClick={() => toggleAdmin(u.id, !u.isAdmin)}
                  >
                    {u.isAdmin ? "Remove Admin" : "Make Admin"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function SettingsForm() {
  const { data: session } = useSession();
  const user = session?.user;

  const { data: profile } = useSWR<UserProfile>(user ? "/api/user/profile" : null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName ?? "");
      setLastName(profile.lastName ?? "");
      setEmail(profile.email ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  const username = user?.username ?? "";
  const initials = ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).toUpperCase() || "U";
  const isAdmin = user?.isAdmin ?? false;

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, bio }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Profile updated", {
        description: "Some changes take effect after your next sign-in.",
      });
    } catch (e) {
      toast.error((e as Error).message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed — please sign in again.");
    } catch (e) {
      toast.error((e as Error).message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-semibold">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your profile, security, and access.</p>
      </div>

      {/* Profile header */}
      <div className="rounded-xl border bg-card px-6 py-5 flex items-center gap-4">
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="avatar" className="h-14 w-14 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="h-14 w-14 rounded-full bg-emerald-500 text-white grid place-items-center text-xl font-semibold flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-lg font-semibold text-foreground leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            {isAdmin && (
              <Badge className="text-[10px] px-1.5 py-0 h-5 gap-1">
                <Shield className="h-3 w-3" />
                Admin
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">@{username}</p>
          {memberSince && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">Member since {memberSince}</p>
          )}
        </div>
      </div>

      {/* Profile edit */}
      <section className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-semibold">Profile</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} disabled readOnly className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Usernames can&apos;t be changed.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short note about yourself…"
              className="resize-none"
              rows={3}
            />
          </div>
          <div className="flex justify-end pt-1">
            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </section>

      {/* Password */}
      <section className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-semibold">Change Password</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <PasswordInput
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>
          </div>
          <div
            className={cn(
              "flex justify-end pt-1",
              newPassword && confirmPassword && newPassword !== confirmPassword && "relative"
            )}
          >
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-destructive">
                Passwords don&apos;t match
              </p>
            )}
            <Button variant="secondary" onClick={changePassword} disabled={savingPassword}>
              {savingPassword ? "Updating…" : "Update password"}
            </Button>
          </div>
        </div>
      </section>

      {/* Admin panel */}
      {isAdmin && <AdminPanel currentUserId={user?.id ?? ""} />}

      {/* Session */}
      <section className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-semibold">Session</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            You&apos;ll be redirected to the login page.
          </p>
        </div>
        <div className="px-6 py-5">
          <Button
            variant="destructive"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </Button>
        </div>
      </section>

    </main>
  );
}
