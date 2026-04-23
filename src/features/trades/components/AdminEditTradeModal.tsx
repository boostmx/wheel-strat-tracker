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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Shield } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Trade } from "@/types";

type Props = {
  trade: Trade;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  ticker: string;
  type: string;
  strikePrice: string;
  contractPrice: string;
  entryPrice: string;
  expirationDate: string;
  contractsInitial: string;
  contractsOpen: string;
  closingPrice: string;
  premiumCaptured: string;
  percentPL: string;
  closeReason: string;
};

function toForm(t: Trade): FormState {
  return {
    ticker: t.ticker,
    type: t.type,
    strikePrice: String(t.strikePrice),
    contractPrice: String(t.contractPrice),
    entryPrice: t.entryPrice != null ? String(t.entryPrice) : "",
    expirationDate: t.expirationDate
      ? format(new Date(t.expirationDate), "yyyy-MM-dd")
      : "",
    contractsInitial: String(t.contractsInitial),
    contractsOpen: String(t.contractsOpen),
    closingPrice: t.closingPrice != null ? String(t.closingPrice) : "",
    premiumCaptured: t.premiumCaptured != null ? String(t.premiumCaptured) : "",
    percentPL: t.percentPL != null ? String(t.percentPL) : "",
    closeReason: t.closeReason ?? "",
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

export function AdminEditTradeModal({ trade, open, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(trade));
  const [saving, setSaving] = useState(false);
  const isClosed = trade.status === "closed";

  useEffect(() => {
    if (open) setForm(toForm(trade));
  }, [open, trade]);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ticker: form.ticker.trim().toUpperCase(),
        type: form.type,
        strikePrice: parseFloat(form.strikePrice),
        contractPrice: parseFloat(form.contractPrice),
        expirationDate: form.expirationDate,
        contractsInitial: parseInt(form.contractsInitial, 10),
        contractsOpen: parseInt(form.contractsOpen, 10),
        contracts: parseInt(form.contractsOpen, 10),
      };
      if (form.entryPrice !== "") payload.entryPrice = parseFloat(form.entryPrice);
      if (isClosed) {
        if (form.closingPrice !== "") payload.closingPrice = parseFloat(form.closingPrice);
        if (form.premiumCaptured !== "") payload.premiumCaptured = parseFloat(form.premiumCaptured);
        if (form.percentPL !== "") payload.percentPL = parseFloat(form.percentPL);
        if (form.closeReason) payload.closeReason = form.closeReason;
      }

      const res = await fetch(`/api/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
      toast.success("Trade updated");
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "Failed to save trade");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Admin Edit — {trade.ticker}
          </DialogTitle>
          <DialogDescription>
            Correct trade data. Metrics recalculate automatically on save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-3 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Trade Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ticker">
                <Input value={form.ticker} onChange={(e) => set("ticker", e.target.value)} className="uppercase" />
              </Field>
              <Field label="Type">
                <Select value={form.type} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CashSecuredPut">Cash Secured Put</SelectItem>
                    <SelectItem value="CoveredCall">Covered Call</SelectItem>
                    <SelectItem value="Put">Put</SelectItem>
                    <SelectItem value="Call">Call</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Strike Price">
                <Input type="text" inputMode="decimal" value={form.strikePrice} onChange={(e) => set("strikePrice", e.target.value)} />
              </Field>
              <Field label="Contract Price (avg)">
                <Input type="text" inputMode="decimal" value={form.contractPrice} onChange={(e) => set("contractPrice", e.target.value)} />
              </Field>
              <Field label="Entry Price">
                <Input type="text" inputMode="decimal" value={form.entryPrice} onChange={(e) => set("entryPrice", e.target.value)} placeholder="Optional" />
              </Field>
              <Field label="Expiration Date">
                <DatePicker value={form.expirationDate} onChange={(v) => set("expirationDate", v)} placeholder="Pick expiry date" />
              </Field>
              <Field label="Contracts (initial)">
                <Input type="text" inputMode="numeric" value={form.contractsInitial} onChange={(e) => set("contractsInitial", e.target.value)} />
              </Field>
              <Field label={isClosed ? "Contracts (closed)" : "Contracts (open)"}>
                <Input type="text" inputMode="numeric" value={form.contractsOpen} onChange={(e) => set("contractsOpen", e.target.value)} />
              </Field>
            </div>
          </div>

          {isClosed && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Close Details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Close Price">
                  <Input type="text" inputMode="decimal" value={form.closingPrice} onChange={(e) => set("closingPrice", e.target.value)} placeholder="0.00" />
                </Field>
                <Field label="Close Reason">
                  <Select value={form.closeReason} onValueChange={(v) => set("closeReason", v)}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="expiredWorthless">Expired Worthless</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Premium Captured ($)">
                  <Input type="text" inputMode="decimal" value={form.premiumCaptured} onChange={(e) => set("premiumCaptured", e.target.value)} placeholder="0.00" />
                </Field>
                <Field label="% P&L">
                  <Input type="text" inputMode="decimal" value={form.percentPL} onChange={(e) => set("percentPL", e.target.value)} placeholder="0.00" />
                </Field>
              </div>
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
