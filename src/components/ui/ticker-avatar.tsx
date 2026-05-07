"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface TickerAvatarProps {
  symbol: string;
  size?: "sm" | "md";
  className?: string;
}

export function TickerAvatar({ symbol, size = "md", className }: TickerAvatarProps) {
  const [error, setError] = useState(false);

  const sizeClass = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";

  if (error) {
    return (
      <div className={cn(sizeClass, "rounded-lg flex items-center justify-center shrink-0 font-bold bg-muted text-muted-foreground", className)}>
        {symbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
      alt={symbol}
      onError={() => setError(true)}
      className={cn(sizeClass, "rounded-lg object-contain bg-white dark:bg-white/90 p-0.5 shrink-0", className)}
    />
  );
}
