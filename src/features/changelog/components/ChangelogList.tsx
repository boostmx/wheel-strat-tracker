// src/features/changelog/ChangelogList.tsx
"use client";

import { ChangelogEntry } from "@/data/changelog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils"; // optional; remove if you don't use cn()
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  items: ChangelogEntry[];
  className?: string;
  initialVisibleCount?: number; // total entries (including Latest) to show before collapsing
  showToggle?: boolean; // allow hiding the toggle entirely if false
}

export default function ChangelogList({ items, className, initialVisibleCount = 4, showToggle = true }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) {
    return (
      <Card className={cn("border bg-card", className)}>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Nothing here yet. Add your first entry in{" "}
          <code>src/data/changelog.ts</code>.
        </CardContent>
      </Card>
    );
  }

  const [latest, ...older] = items;
  // Compute how many older items to show when collapsed. We always show the latest card.
  const collapsedOlderLimit = Math.max(initialVisibleCount - 1, 0);
  const needsToggle = showToggle && older.length > collapsedOlderLimit;
  const olderToShow = expanded || !needsToggle ? older : older.slice(0, collapsedOlderLimit);

  const listId = "changelog-older-list";

  return (
    <div className={className}>
      {/* Latest */}
      <Card className="border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold italic">
            Latest Changes
          </CardTitle>
          <div className="text-base font-semibold mt-1">
            {latest.date}
            {latest.version ? ` (${latest.version})` : ""}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            {latest.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {older.length > 0 && (
        <div className="mt-4 space-y-3" id={listId}>
          {olderToShow.map((entry, idx) => (
            <Card
              key={`${entry.date}-${entry.version ?? idx}`}
              className="border bg-card"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  {entry.date}
                  {entry.version ? ` (${entry.version})` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {entry.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}

          {needsToggle && (
            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-controls={listId}
              >
                {expanded ? "Show less" : "Show all"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
