// src/components/version-badge.tsx
"use client";
import { getLatestVersion } from "@/data/changelog";

export function VersionBadge({ className = "" }: { className?: string }) {
  const version = getLatestVersion();
  return (
    <span className={className} title={`Build ${version}`}>
      {version}
    </span>
  );
}
