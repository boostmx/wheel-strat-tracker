"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AddTradeModal } from "@/components/add-trade-modal";

interface Portfolio {
  id: string;
  name: string | null;
  startingCapital: number;
  currentCapital: number;
}

export function PortfolioDetail({ portfolio }: { portfolio: Portfolio }) {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto py-16 px-6 space-y-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {portfolio.name || "Unnamed Portfolio"}
        </h1>
        <Button variant="default" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      <Card className="bg-white shadow-sm">
        <CardContent className="p-6 space-y-2">
          <p>
            <strong>Starting Capital:</strong> ${" "}
            {portfolio.startingCapital.toLocaleString()}
          </p>
          <p>
            <strong>Current Capital:</strong> ${" "}
            {portfolio.currentCapital.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Open Positions</h2>
        <AddTradeModal portfolioId={portfolio.id} />
      </div>
      <div className="rounded border bg-white p-6 text-gray-500 text-sm italic shadow-sm">
        Open positions table will go here.
      </div>

      <h2 className="text-xl font-semibold mt-10">Closed Positions</h2>
      <div className="rounded border bg-white p-6 text-gray-500 text-sm italic shadow-sm">
        Closed positions table will go here.
      </div>
    </div>
  );
}
