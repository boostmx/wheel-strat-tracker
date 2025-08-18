"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SettingsForm() {
  const { data: session } = useSession();
  const user = session?.user;

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const username = user?.username ?? "";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setEmail(user?.email ?? "");
  }, [user?.firstName, user?.lastName, user?.email]);

  async function saveProfile() {
    try {
      setSavingProfile(true);
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Profile updated", {
        description: "Changes will appear after you sign out and back in.",
      });
      // Optionally refresh UI/session here if desired
      // router.refresh();
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      setSavingPassword(true);
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed", {
        description:
          "Please sign out and sign in again to use your new password.",
      });
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-8 space-y-10">
      <section>
        <h1 className="text-2xl font-semibold">Account Settings</h1>
        <p className="text-sm text-gray-500">
          Manage your profile and security.
        </p>
      </section>

      {/* Profile */}
      <section className="rounded-lg border p-6 bg-white dark:bg-zinc-950">
        <h2 className="text-lg font-medium mb-4">Profile</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="username" className="mb-1 block">
              Username
            </Label>
            <Input id="username" value={username} disabled readOnly />
            <p className="mt-1 text-xs text-gray-500">Usernames can’t be changed.</p>
          </div>
          <div>
            <Label htmlFor="email" className="mb-1 block">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <Label htmlFor="firstName" className="mb-1 block">
              First name
            </Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lastName" className="mb-1 block">
              Last name
            </Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </section>

      {/* Password */}
      <section className="rounded-lg border p-6 bg-white dark:bg-zinc-950">
        <h2 className="text-lg font-medium mb-4">Change password</h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="currentPassword" className="mb-1 block">
              Current password
            </Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="newPassword" className="mb-1 block">
              New password
            </Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword" className="mb-1 block">
              Confirm new password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            onClick={changePassword}
            disabled={savingPassword}
          >
            {savingPassword ? "Updating…" : "Update password"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border p-6 bg-white dark:bg-zinc-950">
        <h2 className="text-lg font-medium mb-4">Session</h2>
        <Button variant="default" onClick={() => signOut()}>
          Sign out
        </Button>
      </section>
    </main>
  );
}
