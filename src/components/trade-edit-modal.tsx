// --- TradeEditModal component ---
import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarIcon } from "lucide-react";
import { Trade } from "@/types";

export function TradeEditModal({
  trade,
  open,
  onOpenChange,
  onSave,
}: {
  trade: Trade;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}) {
  const [latestTrade, setLatestTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<{
    contracts: number;
    strikePrice: number;
    entryPrice: number;
    contractPrice: number;
    expirationDate: string;
    createdAt: string;
    notes: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !trade?.id) return;

    const fetchTrade = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/trades/${trade.id}`);
        const data = await res.json();
        setLatestTrade(data);
        setFormData({
          contracts: data.contracts,
          strikePrice: data.strikePrice,
          contractPrice: data.contractPrice,
          entryPrice: data.entryPrice,
          expirationDate: data.expirationDate,
          createdAt: data.createdAt,
          notes: data.notes ?? "",
        });
      } catch (err) {
        toast.error("Failed to fetch trade details.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrade();
  }, [open, trade?.id]);

  if (loading || !formData || !latestTrade) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading trade...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const isFormChanged =
    formData.expirationDate !== latestTrade.expirationDate ||
    formData.notes !== (latestTrade.notes ?? "") ||
    formData.createdAt !== latestTrade.createdAt;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev!,
      [name]:
        name === "contracts" ||
        name === "strikePrice" ||
        name === "contractPrice"
          ? Number(value)
          : value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/trades/${latestTrade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expirationDate: formData.expirationDate,
          notes: formData.notes,
        }),
      });
      if (!res.ok) throw new Error("Failed to update trade");
      toast.success("Trade updated!");
      onSave();
      onOpenChange(false);
    } catch (e) {
      toast.error("Error saving changes.");
      console.error("Trade update error:", e);
    } finally {
      setSaving(false);
    }
  };

  const formatType = (type: string) => type.replace(/([a-z])([A-Z])/g, "$1 $2");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{latestTrade.ticker} — Trade Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 text-sm text-gray-700">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="flex flex-col gap-6"
          >
            <section className="flex flex-col gap-2">
              <h3 className="font-semibold text-gray-900 mb-2 text-base">
                Basic Info
              </h3>
              <div>
                <label className="block text-sm font-semibold mb-1 text-muted-foreground">
                  Type
                </label>
                <div className="text-sm font-medium">
                  {formatType(latestTrade.type)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-muted-foreground">
                  Contracts
                </label>
                <div className="text-sm">{formData.contracts}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-muted-foreground">
                  Strike Price
                </label>
                <div className="text-sm">
                  ${formData.strikePrice.toFixed(2)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-muted-foreground">
                  Contract Price
                </label>
                <div className="text-sm">
                  ${formData.contractPrice.toFixed(2)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-muted-foreground">
                  Entry Price
                </label>
                <div className="text-sm">
                  {formData.entryPrice !== null &&
                  formData.entryPrice !== undefined
                    ? `$${formData.entryPrice.toFixed(2)}`
                    : "-"}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-muted-foreground">
                  Opened
                </label>
                <div className="text-sm">
                  {formData.createdAt
                    ? new Date(formData.createdAt).toLocaleDateString()
                    : "-"}
                </div>
              </div>
            </section>
            <section className="flex flex-col gap-2">
              <label className="block text-sm font-semibold mb-1 text-muted-foreground">
                Expiration
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !formData.expirationDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.expirationDate ? (
                      format(new Date(formData.expirationDate), "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={new Date(formData.expirationDate)}
                    onSelect={(date) =>
                      date &&
                      setFormData((prev) => ({
                        ...prev!,
                        expirationDate: date.toISOString(),
                      }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </section>

            <section className="flex flex-col gap-2">
              <label className="block text-sm font-semibold mb-1 text-muted-foreground">
                Notes
              </label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={3}
                placeholder="Add notes about this trade..."
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
              />
            </section>

            <div className="border-t pt-4 flex justify-end gap-2">
              <Button
                variant="default"
                type="submit"
                disabled={saving || !isFormChanged}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
