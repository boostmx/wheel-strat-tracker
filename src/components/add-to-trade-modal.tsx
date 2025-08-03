import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AddToTradeModal({
  tradeId,
  open,
  onOpenChange,
  onSave,
}: {
  tradeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}) {
  const [contracts, setContracts] = useState<number>(0);
  const [price, setPrice] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/trades/${tradeId}/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeId,
          contracts,
          price: parseFloat(price),
          notes,
        }),
      });
      if (!res.ok) throw new Error("Failed to add to trade");
      toast.success("Trade adjusted successfully");
      onSave();
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not adjust trade");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Position</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="contracts">Contracts</Label>
            <Input
              id="contracts"
              type="number"
              value={contracts}
              onChange={(e) => setContracts(parseInt(e.target.value))}
              min={1}
              required
            />
          </div>
          <div>
            <Label htmlFor="price">Contract Price</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why did you add to this trade?"
              rows={3}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add to Trade"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
