"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Portfolio } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

type FormValues = {
  name: string;
  startingCapital: number; // RHF wants a number
  additionalCapital: number; // RHF wants a number
  notes?: string;
  // transient-only: used to compose an auto note when additionalCapital changes
  notesDeltaReason?: string;
};
// matches your CurrencyInput API
type CurrencyValue = { formatted: string; raw: number };

function formatUSD(n: number) {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function EditPortfolioForm({ portfolio }: { portfolio: Portfolio }) {
  const router = useRouter();

  // --- 1) Initialize RHF with portfolio values (numbers) ---
  const defaultValues = useMemo<FormValues>(
    () => ({
      name: portfolio.name ?? "",
      startingCapital: Number(portfolio.startingCapital ?? 0),
      additionalCapital: Number(portfolio.additionalCapital ?? 0),
      notes: portfolio.notes ?? "",
    }),
    [portfolio],
  );

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues,
    mode: "onBlur",
  });

  // --- 2) Local UI state for CurrencyInput widgets ---
  const [startingCapUI] = useState<CurrencyValue>({
    formatted: formatUSD(Number(portfolio.startingCapital ?? 0)),
    raw: Number(portfolio.startingCapital ?? 0),
  });

  const [additionalCapUI, setAdditionalCapUI] = useState<CurrencyValue>({
    formatted: formatUSD(Number(portfolio.additionalCapital ?? 0)),
    raw: Number(portfolio.additionalCapital ?? 0),
  });

  // track the baseline locally so the delta reflects the last saved state while staying on-page
  const [oldAddlBase, setOldAddlBase] = useState<number>(
    Number(portfolio.additionalCapital ?? 0),
  );
  const addlWatch = watch("additionalCapital", defaultValues.additionalCapital);
  const addlDelta = (Number(addlWatch) || 0) - oldAddlBase;

  const [notesEditing, setNotesEditing] = useState(false);

  function insertTimestamp() {
    const stamp = `**[${new Date().toLocaleString()}]**`;
    const current = getValues("notes") ?? "";
    const next = current ? `${stamp}\n${current}\n` : stamp;
    setValue("notes", next, { shouldDirty: true, shouldValidate: false });
  }

  async function onSubmit(values: FormValues) {
    try {
      // Compose notes with auto capital adjustment line when applicable
      let outNotes = values.notes ?? "";
      if (addlDelta !== 0) {
        const stamp = `**[${new Date().toLocaleString()}]**`;
        const line = `Capital adjustment: ${addlDelta >= 0 ? "+" : "-"}${formatUSD(Math.abs(addlDelta))} (was ${formatUSD(oldAddlBase)} → ${formatUSD(Number(values.additionalCapital) || 0)})${values.notesDeltaReason ? ` — ${values.notesDeltaReason}` : ""}`;
        outNotes = `${stamp} ${line}\n${outNotes}`.trim();
      }

      const payload = {
        name: values.name,
        startingCapital: values.startingCapital,
        additionalCapital: values.additionalCapital,
        notes: outNotes,
      };

      const res = await fetch(`/api/portfolios/${portfolio.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update portfolio");

      // Update local UI state so deltas and notes reflect immediately without a full reload
      setOldAddlBase(Number(values.additionalCapital) || 0);
      setValue("notes", outNotes, {
        shouldDirty: false,
        shouldValidate: false,
      });
      setNotesEditing(false);

      toast.success("Portfolio updated");
      // Optional: still refresh to sync any other server-driven bits
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Update failed";
      toast.error(message);
    }
  }

  async function onDelete() {
    try {
      const res = await fetch(`/api/portfolios/${portfolio.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete portfolio");
      toast.success("Portfolio deleted");
      router.push("/overview");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast.error(message);
    }
  }

  return (
    <motion.div
      className="max-w-2xl mx-auto py-10 px-6"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Edit Portfolio Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                  placeholder="Portfolio name"
                  {...register("name", { required: "Name is required" })}
                />
                {errors.name && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Capital fields */}
              <div className="space-y-6">
                {/* Starting Capital (locked) */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Starting Capital
                  </label>
                  <CurrencyInput
                    value={startingCapUI}
                    onChange={() => {
                      /* locked */
                    }}
                    placeholder="0.00"
                    disabled
                    aria-label="Starting Capital (locked)"
                  />
                  {/* Preserve startingCapital in submission */}
                  <input type="hidden" {...register("startingCapital")} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Starting capital is a baseline and is locked. Use{" "}
                    <em>Additional Capital</em> for deposits/withdrawals.
                  </p>
                </div>

                {/* Divider */}
                <div className="h-px bg-border" />

                {/* Additional Capital (its own row) */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Additional Capital (Total to date)
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Total external cash added minus withdrawals. Edit to record
                    deposits/withdrawals.
                  </p>
                  <Controller
                    name="additionalCapital"
                    control={control}
                    defaultValue={additionalCapUI.raw}
                    render={({ field }) => (
                      <CurrencyInput
                        value={additionalCapUI}
                        onChange={(next) => {
                          setAdditionalCapUI(next);
                          field.onChange(next?.raw ?? 0);
                        }}
                        placeholder="0.00"
                        disabled={isSubmitting}
                        aria-label="Additional Capital"
                      />
                    )}
                  />

                  <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                    <span>
                      Current: <strong>{formatUSD(oldAddlBase)}</strong>
                    </span>
                    <span>→</span>
                    <span>
                      New: <strong>{formatUSD(Number(addlWatch) || 0)}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Delta:{" "}
                      <strong
                        className={
                          addlDelta >= 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        {addlDelta >= 0 ? "+" : "-"}
                        {formatUSD(Math.abs(addlDelta))}
                      </strong>
                    </span>
                  </div>

                  {addlDelta !== 0 && (
                    <div className="mt-2">
                      <input
                        {...register("notesDeltaReason")}
                        placeholder="Reason for adjustment (optional)"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
              {/* Notes (view -> edit toggle) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Notes</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setNotesEditing((v) => !v)}
                  >
                    {notesEditing ? "Done" : "Edit"}
                  </Button>
                </div>

                {notesEditing ? (
                  <>
                    <Textarea
                      id="notes"
                      rows={6}
                      {...register("notes")}
                      placeholder="Strategy notes, guardrails, etc."
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          void handleSubmit(onSubmit)();
                        }
                      }}
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={insertTimestamp}
                      >
                        Insert timestamp
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        ⌘/Ctrl+Enter to save
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="p-3">
                    {(() => {
                      const notesVal = getValues("notes") ?? "";
                      if (!notesVal.trim()) {
                        return (
                          <p className="text-sm text-gray-600">No notes yet.</p>
                        );
                      }
                      return (
                        <div
                          className="prose text-sm leading-5 text-gray-600 dark:text-gray-400 max-w-none 
                                     prose-strong:text-gray-700 dark:prose-strong:text-gray-300 
                                     prose-p:my-1 prose-li:my-0 prose-ul:my-2 prose-ol:my-2"
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                          >
                            {notesVal}
                          </ReactMarkdown>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Footer: only cancel/save now */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push(`/overview`)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="mt-6"
      >
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">
              Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Deleting this portfolio will permanently remove all associated
              trades and data. This action cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive">
                  Delete portfolio
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this portfolio?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. All trades and data associated
                    with this portfolio will be permanently removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={onDelete}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
