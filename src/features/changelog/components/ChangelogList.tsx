// src/features/changelog/ChangelogList.tsx
"use client";

import { ChangelogEntry } from "@/data/changelog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils"; // optional; remove if you don't use cn()

interface Props {
  items: ChangelogEntry[];
  className?: string;
}

export default function ChangelogList({ items, className }: Props) {
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

      {/* Older entries */}
      {older.length > 0 && (
        <div className="mt-4 space-y-3">
          {older.map((entry, idx) => (
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
        </div>
      )}
    </div>
  );
}
