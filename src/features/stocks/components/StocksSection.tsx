"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddStockModal } from "./AddStockModal";
import { StocksTable } from "./StocksTable";

type Props = {
  portfolioId: string;
};

export function StocksSection({ portfolioId }: Props) {
  const [open, setOpen] = React.useState<boolean>(false);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Stocks</h2>
          <p className="text-sm text-muted-foreground">
            Track underlying share positions and link covered calls to them.
          </p>
        </div>

        <Button onClick={() => setOpen(true)} variant="secondary" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Stock
        </Button>
      </div>

      <StocksTable portfolioId={portfolioId} />

      <AddStockModal portfolioId={portfolioId} open={open} onOpenChange={setOpen} />
    </section>
  );
}