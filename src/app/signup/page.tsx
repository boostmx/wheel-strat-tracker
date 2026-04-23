"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { VersionBadge } from "@/components/layout/VersionBadge";

function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-11 pr-10"
        required
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

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        username: form.username,
        password: form.password,
      }),
    });

    setLoading(false);

    if (res.ok) {
      toast.success("Account created! You can now sign in.");
      router.push("/login");
    } else {
      const data = await res.json();
      toast.error(data.error || "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-2/5 bg-primary flex-col justify-between p-10 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">HLF Wheel Trade Tracker</span>
        </div>

        <div className="space-y-5">
          <blockquote className="text-xl font-semibold leading-snug">
            "Everything you need to track the wheel strategy — without the spreadsheets."
          </blockquote>
          <div className="space-y-2.5">
            {[
              "Cash-secured puts & covered calls",
              "Assignment and expiry workflows",
              "Portfolio-wide P&L and win rate",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-sm text-primary-foreground/80">
                <div className="w-4 h-4 rounded-full bg-primary-foreground/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                {feat}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-primary-foreground/70 uppercase tracking-widest">Wheel Trade Tracker</p>
          <p className="text-xs text-primary-foreground/40 mt-0.5">By HL Financial Strategies</p>
        </div>
      </div>

      {/* Right sign-up panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-primary">Wheel Trade Tracker</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
            <p className="text-muted-foreground text-sm mt-1">Start tracking your wheel trades today.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="firstName">First name</label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="Jane"
                  value={form.firstName}
                  onChange={handleChange}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="lastName">Last name</label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Smith"
                  value={form.lastName}
                  onChange={handleChange}
                  className="h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="email">Email</label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={handleChange}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="username">Username</label>
              <Input
                id="username"
                name="username"
                placeholder="janesmith"
                value={form.username}
                onChange={handleChange}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="password">Password</label>
              <PasswordInput
                id="password"
                name="password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="confirmPassword">Confirm password</label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={handleChange}
              />
            </div>

            <Button className="w-full h-11 text-base font-semibold mt-2" type="submit" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>

          <p className="mt-8 text-center text-[11px] text-muted-foreground/40 flex items-center justify-center gap-2">
            <span>© {new Date().getFullYear()} HL Financial Strategies</span>
            <span className="opacity-40">·</span>
            <Link href="/changelog" className="hover:text-muted-foreground transition-colors flex items-center gap-1">
              <VersionBadge />
              <span>— What&apos;s new</span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
