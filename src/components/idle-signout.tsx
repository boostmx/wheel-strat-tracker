"use client";
import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

type Props = {
  timeoutMs?: number;  // total idle time before signout
  warnMs?: number;     // how long before signout to warn
  onWarn?: () => void; // e.g., toast("Signing out in 1 minute…")
};

export function IdleSignout({
  timeoutMs = 30 * 60 * 1000, // 30m
  warnMs = 60 * 1000,         // 1m
  onWarn,
}: Props) {
  // Use ReturnType<typeof setTimeout> so it works in both browser and node typings
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);

      // schedule warning (if provided) a bit before signout
      if (onWarn && timeoutMs > warnMs) {
        warnTimer.current = setTimeout(onWarn, timeoutMs - warnMs);
      }

      // schedule signout
      timer.current = setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, timeoutMs);
    };

    const events = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
      "visibilitychange",
    ] as const;

    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeoutMs, warnMs, onWarn]);

  return null;
}