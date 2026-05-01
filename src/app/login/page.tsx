"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { VersionBadge } from "@/components/layout/VersionBadge";
import { TrendingUp, Target, CalendarDays, BarChart2 } from "lucide-react";

const FEATURES = [
  { icon: Target, label: "Cash-secured puts & covered calls" },
  { icon: CalendarDays, label: "Assignment and expiry workflows" },
  { icon: BarChart2, label: "Portfolio-wide P&L and win rate" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl: "/summary",
    });

    if (res?.ok) {
      toast.success("Signed in successfully");
      router.push(res.url || "/summary");
    } else {
      toast.error("Invalid credentials");
    }

    setLoading(false);
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
        {/* Amber glow orb — shared HLF brand thread */}
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

      {/* Right — login form */}
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
              <p className="font-bold text-base text-foreground leading-tight">HLF Wheel Trade Tracker</p>
              <p className="text-[11px] text-muted-foreground leading-none">HL Financial Strategies</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground text-sm mt-1.5">Sign in to your portfolio</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="username">Username</label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="password">Password</label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <Button className="w-full h-11 text-base font-semibold mt-2" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <a href="/signup" className="text-primary hover:underline font-medium">
                Sign up
              </a>
            </p>
          </div>

          <p className="mt-8 text-center text-[11px] text-muted-foreground/40 flex items-center justify-center gap-2">
            <span>© {new Date().getFullYear()} HL Financial Strategies</span>
            <span className="opacity-40">·</span>
            <a href="/changelog" className="hover:text-muted-foreground transition-colors flex items-center gap-1">
              <VersionBadge />
              <span>— What&apos;s new</span>
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
