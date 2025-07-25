// src/app/not-found.tsx
"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center text-center px-4">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">Page not found</h1>
      <p className="text-gray-600 mb-6">
        The page you're looking for does not exist or may have been moved.
      </p>
      <Link
        href="/dashboard"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
