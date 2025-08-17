// src/components/portfolio/porfolio-edit-form.tsx
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

type FormValues = {
  name: string;
  startingCapital: number;     // RHF wants a number
  additionalCapital: number;   // RHF wants a number
  notes?: string;
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
  const defaultValues = useMemo<FormValues>(() => ({
    name: portfolio.name ?? "",
    startingCapital: Number(portfolio.startingCapital ?? 0),
    additionalCapital: Number(portfolio.additionalCapital ?? 0),
    notes: portfolio.notes ?? "",
  }), [portfolio]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues,
    mode: "onBlur",
  });

  // --- 2) Local UI state for CurrencyInput widgets ---
  const [startingCapUI, setStartingCapUI] = useState<CurrencyValue>({
  formatted: formatUSD(Number(portfolio.startingCapital ?? 0)),
  raw: Number(portfolio.startingCapital ?? 0),
});

const [additionalCapUI, setAdditionalCapUI] = useState<CurrencyValue>({
  formatted: formatUSD(Number(portfolio.additionalCapital ?? 0)),
  raw: Number(portfolio.additionalCapital ?? 0),
});

  function insertTimestamp() {
    const stamp = `**[${new Date().toLocaleString()}]**`;
    const current = getValues("notes") ?? "";
    const next = current ? `${stamp}\n${current}` : stamp;
    setValue("notes", next, { shouldDirty: true, shouldValidate: false });
  }

  async function onSubmit(values: FormValues) {
    try {
      // values.startingCapital / values.additionalCapital are numbers from RHF
      const res = await fetch(`/api/portfolios/${portfolio.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to update portfolio");
      toast.success("Portfolio updated");
      router.push(`/portfolio/${portfolio.id}/settings`); // stay on the settings page after saving
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Update failed";
      toast.error(message);
    }
  }

  async function onDelete() {
    try {
      const res = await fetch(`/api/portfolios/${portfolio.id}`, { method: "DELETE" });
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
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle>Edit Portfolio</CardTitle>
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
                {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
              </div>

              {/* Capital fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Starting Capital</label>
                  <Controller
                    name="startingCapital"
                    control={control}
                    defaultValue={startingCapUI.raw} // make sure RHF has a number
                    render={({ field }) => (
                      <CurrencyInput
                        value={startingCapUI}               
                        onChange={(next) => {               // <- your prop name
                          setStartingCapUI(next);
                          field.onChange(next?.raw ?? 0);   // <- push raw number into RHF
                        }}
                        placeholder="0.00"
                        disabled={isSubmitting}
                        aria-label="Starting Capital"
                      />
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Additional Capital</label>
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
                </div>
              </div>
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
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
                <div className="mt-1 flex justify-end">
                  <span className="text-xs text-muted-foreground">⌘/Ctrl+Enter to save</span>
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <Button type="button" variant="secondary" size="sm" onClick={insertTimestamp}>
                    Insert timestamp
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive" size="sm">
                        Delete portfolio
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this portfolio?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. All trades and data associated with this portfolio will be permanently removed.
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
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => router.push(`/portfolio/${portfolio.id}`)}> 
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}