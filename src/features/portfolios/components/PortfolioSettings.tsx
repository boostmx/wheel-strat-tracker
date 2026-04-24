"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CalendarIcon, Trash2, Plus, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Portfolio, CapitalTransaction } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type CurrencyValue = { formatted: string; raw: number };
type TransactionForm = {
  type: "deposit" | "withdrawal";
  amount: CurrencyValue;
  note: string;
};
type NameForm = { name: string };

export function PortfolioSettings({ portfolio }: { portfolio: Portfolio }) {
  const router = useRouter();
  const { data, mutate: mutateTransactions } = useSWR<{ transactions: CapitalTransaction[] }>(
    `/api/portfolios/${portfolio.id}/capital-transactions`,
    fetcher,
  );
  const transactions = data?.transactions ?? [];

  // ── Name section ──────────────────────────────────────────────────────────
  const nameForm = useForm<NameForm>({ defaultValues: { name: portfolio.name ?? "" } });

  async function saveName(values: NameForm) {
    const res = await fetch(`/api/portfolios/${portfolio.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: values.name }),
    });
    if (!res.ok) { toast.error("Failed to update name"); return; }
    toast.success("Name updated");
    await Promise.allSettled([mutate("/api/portfolios"), mutate(`/api/portfolios/${portfolio.id}`)]);
    router.refresh();
  }

  // ── Transaction form ──────────────────────────────────────────────────────
  const [txAmountUI, setTxAmountUI] = useState<CurrencyValue>({ formatted: "", raw: 0 });
  const [txDate, setTxDate] = useState<Date | undefined>(new Date());
  const [txCalOpen, setTxCalOpen] = useState(false);

  const txForm = useForm<TransactionForm>({
    defaultValues: { type: "deposit", amount: { formatted: "", raw: 0 }, note: "" },
  });
  const txType = txForm.watch("type");

  async function submitTransaction(values: TransactionForm) {
    if (!values.amount.raw || values.amount.raw <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const res = await fetch(`/api/portfolios/${portfolio.id}/capital-transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: values.type,
        amount: values.amount.raw,
        note: values.note || null,
        date: txDate ? txDate.toISOString() : new Date().toISOString(),
      }),
    });
    if (!res.ok) { toast.error("Failed to record transaction"); return; }
    toast.success(values.type === "deposit" ? "Deposit recorded" : "Withdrawal recorded");
    txForm.reset({ type: "deposit", amount: { formatted: "", raw: 0 }, note: "" });
    setTxAmountUI({ formatted: "", raw: 0 });
    setTxDate(new Date());
    await mutateTransactions();
    await Promise.allSettled([
      mutate(`/api/portfolios/${portfolio.id}/metrics`),
      mutate(`/api/portfolios/${portfolio.id}/detail-metrics`),
      mutate("/api/account/summary"),
    ]);
  }

  // ── Delete transaction ────────────────────────────────────────────────────
  async function deleteTransaction(transactionId: string) {
    const res = await fetch(`/api/portfolios/${portfolio.id}/capital-transactions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    });
    if (!res.ok) { toast.error("Failed to delete transaction"); return; }
    toast.success("Transaction removed");
    await mutateTransactions();
    await Promise.allSettled([
      mutate(`/api/portfolios/${portfolio.id}/metrics`),
      mutate(`/api/portfolios/${portfolio.id}/detail-metrics`),
      mutate("/api/account/summary"),
    ]);
  }

  // ── Notes section ─────────────────────────────────────────────────────────
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesValue, setNotesValue] = useState(portfolio.notes ?? "");

  async function saveNotes() {
    const res = await fetch(`/api/portfolios/${portfolio.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesValue }),
    });
    if (!res.ok) { toast.error("Failed to save notes"); return; }
    toast.success("Notes saved");
    setNotesEditing(false);
    await mutate(`/api/portfolios/${portfolio.id}`);
    router.refresh();
  }

  // ── Delete portfolio ──────────────────────────────────────────────────────
  async function deletePortfolio() {
    const res = await fetch(`/api/portfolios/${portfolio.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete portfolio"); return; }
    toast.success("Portfolio deleted");
    await Promise.allSettled([mutate("/api/portfolios"), mutate("/api/account/summary")]);
    router.push("/portfolios");
    router.refresh();
  }

  // ── Derived capital totals ────────────────────────────────────────────────
  const totalDeposits = transactions
    .filter((t) => t.type === "deposit")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalWithdrawals = transactions
    .filter((t) => t.type === "withdrawal")
    .reduce((s, t) => s + Number(t.amount), 0);
  const netAdj = totalDeposits - totalWithdrawals;

  return (
    <div className="space-y-6">

      {/* ── Portfolio Name ── */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Portfolio Name</h3>
        <form onSubmit={nameForm.handleSubmit(saveName)} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="portfolio-name">Name</Label>
            <Input
              id="portfolio-name"
              placeholder="Portfolio name"
              {...nameForm.register("name", { required: true })}
            />
          </div>
          <Button type="submit" size="sm" disabled={nameForm.formState.isSubmitting}>
            {nameForm.formState.isSubmitting ? "Saving…" : "Save"}
          </Button>
        </form>
      </section>

      {/* ── Capital Management ── */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Capital Management</h3>
          <p className="text-xs text-muted-foreground">
            Starting: <span className="font-medium text-foreground">{formatUSD(Number(portfolio.startingCapital))}</span>
            {" "}·{" "}
            Net adj:{" "}
            <span className={cn("font-medium", netAdj >= 0 ? "text-teal-600 dark:text-teal-400" : "text-red-500")}>
              {netAdj >= 0 ? "+" : ""}{formatUSD(netAdj)}
            </span>
          </p>
        </div>

        {/* Add transaction form */}
        <form onSubmit={txForm.handleSubmit(submitTransaction)} className="space-y-4">
          {/* Type toggle */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
            {(["deposit", "withdrawal"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => txForm.setValue("type", t)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize",
                  txType === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "deposit"
                  ? <ArrowDownCircle className="h-3.5 w-3.5 text-teal-500" />
                  : <ArrowUpCircle className="h-3.5 w-3.5 text-red-500" />}
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Amount */}
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Controller
                name="amount"
                control={txForm.control}
                render={({ field }) => (
                  <CurrencyInput
                    value={txAmountUI}
                    onChange={(v) => { setTxAmountUI(v); field.onChange(v); }}
                    placeholder="$0.00"
                  />
                )}
              />
            </div>

            {/* Date — Popover + Calendar */}
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Popover open={txCalOpen} onOpenChange={setTxCalOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !txDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {txDate ? format(txDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={txDate}
                    onSelect={(d) => { setTxDate(d); setTxCalOpen(false); }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="tx-note">Note</Label>
              <Input
                id="tx-note"
                placeholder="Optional note"
                {...txForm.register("note")}
              />
            </div>
          </div>

          <Button
            type="submit"
            size="sm"
            variant={txType === "deposit" ? "default" : "destructive"}
            disabled={txForm.formState.isSubmitting}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {txForm.formState.isSubmitting
              ? "Recording…"
              : txType === "deposit" ? "Record Deposit" : "Record Withdrawal"}
          </Button>
        </form>

        {/* Transaction log */}
        {transactions.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">History</p>
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 bg-background">
                  {tx.type === "deposit"
                    ? <ArrowDownCircle className="h-4 w-4 shrink-0 text-teal-500" />
                    : <ArrowUpCircle className="h-4 w-4 shrink-0 text-red-500" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-sm font-semibold tabular-nums",
                        tx.type === "deposit" ? "text-teal-600 dark:text-teal-400" : "text-red-500")}>
                        {tx.type === "deposit" ? "+" : "-"}{formatUSD(Number(tx.amount))}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                      {tx.note && (
                        <span className="text-xs text-muted-foreground truncate">{tx.note}</span>
                      )}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        title="Remove transaction"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this transaction?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the {tx.type} of {formatUSD(Number(tx.amount))} from{" "}
                          {formatDate(tx.date)}. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteTransaction(tx.id)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-1 pt-1">
              <span>
                Total deposits:{" "}
                <span className="text-teal-600 dark:text-teal-400 font-medium">{formatUSD(totalDeposits)}</span>
              </span>
              <span>
                Total withdrawals:{" "}
                <span className="text-red-500 font-medium">{formatUSD(totalWithdrawals)}</span>
              </span>
            </div>
          </div>
        )}

        {transactions.length === 0 && (
          <p className="text-xs text-muted-foreground">No deposits or withdrawals recorded yet.</p>
        )}
      </section>

      {/* ── Notes ── */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Notes</h3>
          {notesEditing ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setNotesValue(portfolio.notes ?? ""); setNotesEditing(false); }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={saveNotes}>Save</Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setNotesEditing(true)}>
              Edit
            </Button>
          )}
        </div>
        {notesEditing ? (
          <Textarea
            rows={5}
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder="Strategy notes, guardrails, etc."
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void saveNotes();
              }
            }}
          />
        ) : (
          <div className="p-2 min-h-[40px]">
            {notesValue.trim() ? (
              <div className="prose text-sm leading-5 text-gray-600 dark:text-gray-400 max-w-none prose-strong:text-gray-700 dark:prose-strong:text-gray-300 prose-p:my-1 prose-li:my-0 prose-ul:my-2 prose-ol:my-2">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                  {notesValue}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            )}
          </div>
        )}
      </section>

      {/* ── Danger Zone ── */}
      <section className="rounded-xl border border-red-200 dark:border-red-900 bg-card p-5">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Danger zone</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Deleting this portfolio permanently removes all associated trades and data. This cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" size="sm">Delete portfolio</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this portfolio?</AlertDialogTitle>
              <AlertDialogDescription>
                All trades and data associated with this portfolio will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={deletePortfolio}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

    </div>
  );
}
