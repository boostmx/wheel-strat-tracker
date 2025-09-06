"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

export default function ThemeCookieSync() {
  const { theme, resolvedTheme } = useTheme();
  const t = theme ?? resolvedTheme;

  useEffect(() => {
    if (t === "dark" || t === "light") {
      document.cookie = `wheeltracker.theme=${t}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }
  }, [t]);

  return null;
}
