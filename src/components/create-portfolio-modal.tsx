"use client";

import { useState } from "react";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { mutate } from "swr";

export function CreatePortfolioModal() {
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
      toast.success("A new portfolio has been added!");
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
        <Button variant="default">Create Portfolio</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Portfolio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Portfolio Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <CurrencyInput
            value={capital}
            onChange={setCapital}
            placeholder="Starting Capital"
          />

          <Button
            onClick={handleSubmit}
            disabled={isLoading || !name || capital.raw <= 0}
          >
            {isLoading ? "Creating..." : "Create Portfolio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
