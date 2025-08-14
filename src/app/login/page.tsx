"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

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
      callbackUrl: "/overview",
    });

    if (res?.ok) {
      toast.success("Signed in successfully");
      router.push(res.url || "/overview");
    } else {
      toast.error("Invalid credentials");
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted px-4">
      <h1 className="text-2xl font-bold italic mb-6 text-primary">
        Trade Tracker
      </h1>
      <Card className="w-full max-w-md p-4 shadow-md">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-2xl font-semibold text-center">Login</h2>
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground mt-4">
        developed by HL Financial Strategies
      </p>
      <p className="text-sm mt-2 text-center">
        Don’t have an account?{" "}
        <a href="/signup" className="text-blue-600 hover:underline font-medium">
          Sign up here
        </a>
      </p>
    </div>
  );
}
