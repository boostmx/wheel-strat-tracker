// components/portfolio-detail.tsx
"use client";

import { useRouter } from "next/navigation";

interface Portfolio {
  id: string;
  name: string | null;
  startingCapital: number;
  currentCapital: number;
}

export function PortfolioDetail({ portfolio }: { portfolio: Portfolio }) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {portfolio.name || "Unnamed Portfolio"}
        </h1>
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:underline text-sm"
        >
          ← Back
        </button>
      </div>
      <div className="rounded-lg border p-4 bg-white shadow-sm space-y-2">
        <p>
          <strong>Starting Capital:</strong> $
          {portfolio.startingCapital.toLocaleString()}
        </p>
        <p>
          <strong>Current Capital:</strong> $
          {portfolio.currentCapital.toLocaleString()}
        </p>
      </div>

      {/* 🔜 Placeholder sections */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-2">Add New Trade</h2>
        <div className="border p-4 rounded bg-gray-50 text-gray-500 italic">
          Trade entry form goes here...
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Trade History</h2>
        <div className="border p-4 rounded bg-gray-50 text-gray-500 italic">
          Trade table goes here...
        </div>
      </div>
    </div>
  );
}
