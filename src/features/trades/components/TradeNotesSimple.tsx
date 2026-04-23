"use client";

import { useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

export interface TradeNotesHandle {
  startEditing: () => void;
  isEditing: () => boolean;
}

type Props = {
  tradeId: string;
  initialNotes?: string | null;
  className?: string;
  onSaved?: (notes: string) => void;
  hideHeader?: boolean;
  onEditingChange?: (editing: boolean) => void;
};

export const TradeNotesSimple = forwardRef<TradeNotesHandle, Props>(
  function TradeNotesSimple(
    { tradeId, initialNotes, className, onSaved, hideHeader, onEditingChange },
    ref,
  ) {
    const [editing, setEditing] = useState(false);
    const [notes, setNotes] = useState(initialNotes ?? "");
    const [draft, setDraft] = useState(initialNotes ?? "");
    const [busy, setBusy] = useState(false);
    function setEditingWithCallback(value: boolean) {
      setEditing(value);
      onEditingChange?.(value);
    }

    useImperativeHandle(ref, () => ({
      startEditing: () => setEditingWithCallback(true),
      isEditing: () => editing,
    }));

    async function save() {
      const payload = draft ?? "";
      setBusy(true);
      try {
        const res = await fetch(`/api/trades/${tradeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: payload }),
        });
        if (!res.ok) throw new Error("Failed to save notes");
        const json = await res.json();
        setNotes(json.notes ?? "");
        setDraft(json.notes ?? "");
        setEditingWithCallback(false);
        toast.success("Notes saved");
        onSaved?.(json.notes ?? "");
      } catch (e: unknown) {
        if (e instanceof Error) {
          toast.error(e.message || "Save failed");
        } else {
          toast.error("Save failed");
        }
      } finally {
        setBusy(false);
      }
    }

    return (
      <section className={cn("bg-transparent", className)}>
        {!hideHeader && (
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">Notes</h3>
            {!editing ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingWithCallback(true)}
              >
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingWithCallback(false);
                    setDraft(notes);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={save} disabled={busy}>
                  Save
                </Button>
              </div>
            )}
          </div>
        )}

        {!editing && (
          <div className={hideHeader ? "" : "p-3"}>
            {notes?.trim() ? (
              <div
                className="prose text-sm leading-5 text-gray-600 dark:text-gray-400 max-w-none
                            prose-strong:text-gray-700 dark:prose-strong:text-gray-300
                            prose-p:my-1 prose-li:my-0 prose-ul:my-2 prose-ol:my-2"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                  {notes}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            )}
          </div>
        )}

        {editing && (
          <div className={hideHeader ? "" : "p-3"}>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[180px]"
              placeholder={`Jot anything: "Adding to position here to avg down"`}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">⌘/Ctrl+Enter to save</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingWithCallback(false);
                    setDraft(notes);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={save} disabled={busy}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  },
);
