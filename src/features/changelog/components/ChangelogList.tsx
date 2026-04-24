"use client";

import { ChangelogEntry } from "@/data/changelog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

interface Props {
  items: ChangelogEntry[];
  className?: string;
  initialVisibleCount?: number;
  showToggle?: boolean;
}

export default function ChangelogList({
  items,
  className,
  initialVisibleCount = 4,
  showToggle = true,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No entries yet. Add your first entry in{" "}
        <code className="font-mono text-xs">src/data/changelog.ts</code>.
      </p>
    );
  }

  const needsToggle = showToggle && items.length > initialVisibleCount;
  const visibleItems = needsToggle && !expanded ? items.slice(0, initialVisibleCount) : items;
  const hiddenCount = items.length - initialVisibleCount;

  return (
    <div className={cn("relative", className)}>
      <div className="space-y-0">
        {visibleItems.map((entry, idx) => {
          const isLatest = idx === 0;
          const isLast = idx === visibleItems.length - 1 && (!needsToggle || expanded);

          return (
            <div
              key={`${entry.date}-${entry.version ?? idx}`}
              className={cn("relative pl-7", isLast ? "pb-0" : "pb-8")}
            >
              {/* Timeline connector line — omit on the last visible entry */}
              {!isLast && (
                <div className="absolute left-[6px] top-[20px] bottom-0 w-px bg-border" />
              )}

              {/* Dot */}
              <div
                className={cn(
                  "absolute left-0 top-[5px] h-3.5 w-3.5 rounded-full border-2 z-10",
                  isLatest
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-border bg-background",
                )}
              />

              {/* Entry header */}
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                {entry.version && (
                  <span className="font-mono text-sm font-semibold tracking-tight">
                    {entry.version}
                  </span>
                )}
                {isLatest && (
                  <Badge
                    variant="secondary"
                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-normal text-[11px] px-1.5 py-0"
                  >
                    Latest
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDate(entry.date)}
                </span>
              </div>

              {/* Highlights */}
              <ul className="space-y-2">
                {entry.highlights.map((h, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                    <span className="text-muted-foreground leading-relaxed">{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {needsToggle && (
        <div className="pl-7 mt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-7 px-2 hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? "Show less"
              : `Show ${hiddenCount} older release${hiddenCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}
