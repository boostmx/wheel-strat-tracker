"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, TrendingUp, Target, CalendarDays, BarChart2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { VersionBadge } from "@/components/layout/VersionBadge";

const FEATURES = [
  { icon: Target, label: "Cash-secured puts & covered calls" },
  { icon: CalendarDays, label: "Assignment and expiry workflows" },
  { icon: BarChart2, label: "Portfolio-wide P&L and win rate" },
];

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
      {/* Left — brand panel */}
      <div
        className="hidden lg:flex lg:w-2/5 flex-col justify-between p-10 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, oklch(0.44 0.18 155), oklch(0.36 0.16 162) 60%, oklch(0.28 0.12 168))" }}
      >
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        {/* Amber glow orb */}
        <div
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-20 blur-3xl"
          style={{ background: "oklch(0.72 0.17 65)" }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3 z-10">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)" }}
          >
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-base leading-tight">HLF Wheel Trade Tracker</p>
            <p className="text-[11px] text-white/60 leading-none mt-0.5">HL Financial Strategies</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Options Trading</p>
            <h2 className="text-3xl font-bold leading-snug tracking-tight">
              Track the wheel.<br />Skip the spreadsheets.
            </h2>
            <p className="text-sm text-white/70 leading-relaxed max-w-xs">
              Everything you need to run the wheel strategy — positions, P&L, expiry tracking, and more.
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.12)" }}
                >
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm text-white/80">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <div className="h-px bg-white/10 mb-4" />
          <p className="text-[11px] text-white/40">© {new Date().getFullYear()} HL Financial Strategies</p>
        </div>
      </div>

      {/* Right sign-up panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-base text-foreground leading-tight">Wheel Trade Tracker</p>
              <p className="text-[11px] text-muted-foreground leading-none">HL Financial Strategies</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Create your account</h2>
            <p className="text-muted-foreground text-sm mt-1.5">Start tracking your wheel trades today.</p>
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
