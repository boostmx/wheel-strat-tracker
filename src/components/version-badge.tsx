// src/components/version-badge.tsx
"use client";

export function VersionBadge({ className = "" }: { className?: string }) {
  const v = process.env.NEXT_PUBLIC_APP_VERSION || "v0.0.0";
  return (
    <span className={className} title={`Build ${v}`}>
      {v}
    </span>
  );
}