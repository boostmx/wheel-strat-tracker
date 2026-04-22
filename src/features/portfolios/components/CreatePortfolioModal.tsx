"use client";

import { useState } from "react";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { mutate } from "swr";

export function CreatePortfolioModal({ trigger }: { trigger?: React.ReactNode } = {}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [capital, setCapital] = useState({ formatted: "", raw: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    setIsLoading(true);

    const res = await fetch("/api/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, startingCapital: capital.raw }),
    });

    setIsLoading(false);

    if (res.ok) {
      toast.success("Portfolio created!");
      mutate("/api/portfolios");
      setOpen(false);
      setName("");
      setCapital({ formatted: "", raw: 0 });
      router.refresh();
    } else {
      toast.error("Failed to create portfolio");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="default">Create Portfolio</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create New Portfolio</DialogTitle>
          <DialogDescription>
            Name your portfolio and set a starting capital amount to track allocation and returns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="portfolio-name">Portfolio Name</Label>
            <Input
              id="portfolio-name"
              type="text"
              placeholder="e.g. Wheel Strategy"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="starting-capital">Starting Capital</Label>
            <CurrencyInput
              value={capital}
              onChange={setCapital}
              placeholder="e.g. $25,000"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !name.trim() || capital.raw <= 0}
          >
            {isLoading ? "Creating…" : "Create Portfolio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
