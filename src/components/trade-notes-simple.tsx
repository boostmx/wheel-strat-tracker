"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

type Props = {
  tradeId: string;
  initialNotes?: string | null;
  className?: string;
  onSaved?: (notes: string) => void; // optional hook if parent wants to refresh
};

export function TradeNotesSimple({ tradeId, initialNotes, className, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [draft, setDraft] = useState(initialNotes ?? "");
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

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
      setEditing(false);
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

  function insertTimestamp() {
    const ts = new Date();
    // Simple local timestamp; adjust format if you prefer
    const stamp = `**[${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}]**`;
    const el = taRef.current;
    if (!el) {
      setDraft((d) => (d ?? "") + stamp);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = (draft ?? "").slice(0, start) + stamp + (draft ?? "").slice(end);
    setDraft(next);
    // Restore caret just after inserted text
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + stamp.length;
      el.focus();
    });
  }

  return (
    <section className={cn("bg-transparent", className)}>
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Notes</h3>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDraft(notes); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              Save
            </Button>
          </div>
        )}
      </div>

      {/* View mode */}
      {!editing && (
        <div className="p-3">
          {notes?.trim() ? (
            <div className="prose text-sm leading-5 text-gray-600 dark:text-gray-400 max-w-none 
                            prose-strong:text-gray-700 dark:prose-strong:text-gray-300 
                            prose-p:my-1 prose-li:my-0 prose-ul:my-2 prose-ol:my-2">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {notes}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No notes yet.</p>
          )}
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="p-3">
          <Textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[220px]"
            placeholder={`Jot anything: "Adding to position here to avg down"`}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={insertTimestamp}>
              Insert timestamp
            </Button>
            <div className="text-xs text-gray-500">⌘/Ctrl+Enter to save</div>
          </div>
        </div>
      )}
    </section>
  );
}