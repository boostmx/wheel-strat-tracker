// src/app/not-found.tsx
"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center text-center px-4">
      <h1 className="text-4xl font-bold text-foreground mb-4">Page not found</h1>
      <p className="text-muted-foreground mb-6">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link
        href="/summary"
        className="bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90 transition"
      >
        Back to Main Page
      </Link>
    </div>
  );
}
