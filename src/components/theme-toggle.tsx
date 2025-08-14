"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const active = theme === "system" ? systemTheme : theme;
  const isDark = active === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-md border px-3 py-1.5 text-sm transition
                 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700
                 border-gray-200 dark:border-gray-700"
      title="Toggle theme"
    >
      {isDark ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}