"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "wheeltracker.theme" as const; // must match ThemeProvider + layout

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid SSR hydration mismatch: render only after mount when theme is known
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const current = (theme ?? resolvedTheme) as "light" | "dark" | undefined;
  const isDark = current === "dark";
  const nextTheme = isDark ? "light" : "dark";

  function persist(value: "light" | "dark"): void {
    // Write to localStorage so pre-hydration script can read it on next load
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {}
    // Mirror to cookie for optional SSR/middleware usage
    try {
      document.cookie = `${STORAGE_KEY}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {}
  }

  function handleClick() {
    setTheme(nextTheme); // updates <html class> via next-themes
    persist(nextTheme); // guarantee persistence across refreshes
  }

  return (
    <button
      onClick={handleClick}
      className="p-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={`Switch to ${nextTheme} mode`}
      type="button"
      data-component-source="src/components/theme-toggle.tsx"
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-yellow-400" />
      ) : (
        <Moon className="h-5 w-5 text-gray-700" />
      )}
    </button>
  );
}
