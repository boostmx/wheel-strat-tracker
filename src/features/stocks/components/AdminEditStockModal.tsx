"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Shield } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { StockLot } from "@/types";

type Props = {
  stockLot: StockLot;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  ticker: string;
  shares: string;
  avgCost: string;
  openedAt: string;
  notes: string;
  closedAt: string;
  closePrice: string;
  realizedPnl: string;
};

function toDateStr(v: string | Date | null | undefined): string {
  if (!v) return "";
  try {
    return format(new Date(v), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

function toForm(s: StockLot): FormState {
  return {
    ticker: s.ticker,
    shares: String(s.shares),
    avgCost: String(Number(s.avgCost)),
    openedAt: toDateStr(s.openedAt),
    notes: (s as StockLot & { notes?: string | null }).notes ?? "",
    closedAt: toDateStr(s.closedAt),
    closePrice: s.closePrice != null ? String(Number(s.closePrice)) : "",
    realizedPnl: s.realizedPnl != null ? String(Number(s.realizedPnl)) : "",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const parsed = value ? new Date(value + "T12:00:00") : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {parsed ? format(parsed, "PPP") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function AdminEditStockModal({ stockLot, open, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(stockLot));
  const [saving, setSaving] = useState(false);
  const isClosed = String(stockLot.status).toUpperCase() === "CLOSED";

  useEffect(() => {
    if (open) setForm(toForm(stockLot));
  }, [open, stockLot]);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        adminEdit: true,
        ticker: form.ticker.trim().toUpperCase(),
        shares: parseInt(form.shares, 10),
        avgCost: parseFloat(form.avgCost),
        openedAt: form.openedAt || undefined,
        notes: form.notes || null,
      };
      if (isClosed) {
        if (form.closedAt) payload.closedAt = form.closedAt;
        if (form.closePrice !== "") payload.closePrice = parseFloat(form.closePrice);
        if (form.realizedPnl !== "") payload.realizedPnl = parseFloat(form.realizedPnl);
      }

      const res = await fetch(`/api/stocks/${stockLot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
      toast.success("Stock lot updated");
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "Failed to save stock lot");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Admin Edit — {stockLot.ticker}
          </DialogTitle>
          <DialogDescription>
            Correct stock lot data. Cost basis and P&amp;L recalculate automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-3 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Lot Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ticker">
                <Input value={form.ticker} onChange={(e) => set("ticker", e.target.value)} className="uppercase" />
              </Field>
              <Field label="Shares">
                <Input type="text" inputMode="numeric" value={form.shares} onChange={(e) => set("shares", e.target.value)} />
              </Field>
              <Field label="Avg Cost / Share">
                <Input type="text" inputMode="decimal" value={form.avgCost} onChange={(e) => set("avgCost", e.target.value)} />
              </Field>
              <Field label="Opened Date">
                <DatePicker value={form.openedAt} onChange={(v) => set("openedAt", v)} placeholder="Pick open date" />
              </Field>
            </div>
            <Field label="Notes">
              <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
            </Field>
          </div>

          {isClosed && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Close Details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Close Price / Share">
                  <Input type="text" inputMode="decimal" value={form.closePrice} onChange={(e) => set("closePrice", e.target.value)} placeholder="0.00" />
                </Field>
                <Field label="Closed Date">
                  <DatePicker value={form.closedAt} onChange={(v) => set("closedAt", v)} placeholder="Pick close date" />
                </Field>
              </div>
              <Field label="Realized P&L ($)">
                <Input type="text" inputMode="decimal" value={form.realizedPnl} onChange={(e) => set("realizedPnl", e.target.value)} placeholder="0.00" />
              </Field>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
