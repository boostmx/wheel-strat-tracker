"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TypeBadge } from "@/features/trades/components/TypeBadge";
import type { JournalResponse, JournalTrade } from "@/app/api/journal/[yearMonth]/route";
import type { Portfolio } from "@/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function toYearMonth(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function formatUSD(n: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(n);
}

function moneyColor(n: number) {
  if (n > 0) return "text-emerald-600 dark:text-emerald-400";
  if (n < 0) return "text-red-500 dark:text-red-400";
  return "text-muted-foreground";
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── calendar ────────────────────────────────────────────────────────────────

function CalendarGrid({
  year,
  month,
  days,
  selectedDate,
  onSelect,
}: {
  year: number;
  month: number; // 1-based
  days: JournalResponse["days"];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
  const today = new Date().toISOString().slice(0, 10);

  const cells: Array<{ date: string; day: number } | null> = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, day };
    }),
  ];

  return (
    <div className="select-none">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`pad-${i}`} />;
          const data = days[cell.date];
          const hasActivity = !!data;
          const isSelected = cell.date === selectedDate;
          const isToday = cell.date === today;
          const pnl = data?.pnl ?? 0;

          return (
            <button
              key={cell.date}
              onClick={() => onSelect(isSelected ? "" : cell.date)}
              className={cn(
                "relative flex flex-col items-center justify-start rounded-lg p-1.5 min-h-[56px] transition-all text-left",
                hasActivity ? "cursor-pointer hover:ring-2 hover:ring-ring/40" : "cursor-default",
                isSelected && "ring-2 ring-primary",
                !hasActivity && "opacity-50",
                hasActivity && pnl > 0 && !isSelected && "bg-emerald-50 dark:bg-emerald-950/40",
                hasActivity && pnl < 0 && !isSelected && "bg-rose-50 dark:bg-rose-950/40",
                hasActivity && pnl === 0 && !isSelected && "bg-muted/60",
                isSelected && pnl > 0 && "bg-emerald-100 dark:bg-emerald-900/50",
                isSelected && pnl < 0 && "bg-rose-100 dark:bg-rose-900/50",
                isSelected && pnl === 0 && "bg-muted",
              )}
            >
              <span className={cn(
                "text-[11px] font-semibold leading-none mb-1",
                isToday ? "text-primary" : "text-foreground",
              )}>
                {cell.day}
              </span>
              {hasActivity && (
                <>
                  <span className={cn("text-[10px] font-medium tabular-nums leading-none", moneyColor(pnl))}>
                    {pnl >= 0 ? "+" : ""}{formatUSD(pnl, true)}
                  </span>
                  {data.tradeCount > 1 && (
                    <span className="text-[9px] text-muted-foreground mt-0.5">
                      {data.tradeCount} trades
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── day detail panel ─────────────────────────────────────────────────────────

function DayPanel({
  date,
  trades,
  onClose,
}: {
  date: string;
  trades: JournalTrade[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [,,] = date.split("-");
  const label = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const showPortfolio = new Set(trades.map((t) => t.portfolioId)).size > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl border bg-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className={cn("text-xs font-medium tabular-nums", moneyColor(totalPnl))}>
            {totalPnl >= 0 ? "+" : ""}{formatUSD(totalPnl)} total
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
        >
          Dismiss
        </button>
      </div>

      <div className="space-y-2">
        {trades.map((t) => (
          <button
            key={`${t.kind}-${t.id}`}
            onClick={() =>
              router.push(
                t.kind === "trade"
                  ? `/portfolios/${t.portfolioId}/trades/${t.id}`
                  : `/portfolios/${t.portfolioId}/stocks/${t.id}`,
              )
            }
            className="w-full flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-foreground">{t.ticker}</span>
              <TypeBadge type={t.type} />
              {showPortfolio && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate">
                  {t.portfolioName}
                </span>
              )}
            </div>
            <span className={cn("tabular-nums font-medium shrink-0", moneyColor(t.pnl))}>
              {t.pnl >= 0 ? "+" : ""}{formatUSD(t.pnl)}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── month picker popover ────────────────────────────────────────────────────

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthPicker({
  activeYear,
  activeMonth,
  maxYear,
  maxMonth,
  onSelect,
  onClose,
}: {
  activeYear: number;
  activeMonth: number;
  maxYear: number;
  maxMonth: number;
  onSelect: (y: number, m: number) => void;
  onClose: () => void;
}) {
  const [pickerYear, setPickerYear] = useState(activeYear);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[100] bg-card border border-border rounded-xl shadow-lg p-3 w-52"
    >
      {/* Year navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setPickerYear((y) => y - 1)}
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-sm font-semibold text-foreground">{pickerYear}</span>
        <button
          onClick={() => setPickerYear((y) => y + 1)}
          disabled={pickerYear >= maxYear}
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-3 gap-1">
        {MONTH_LABELS.map((label, i) => {
          const m = i + 1;
          const isActive = pickerYear === activeYear && m === activeMonth;
          const isFuture = pickerYear > maxYear || (pickerYear === maxYear && m > maxMonth);
          return (
            <button
              key={label}
              onClick={() => { if (!isFuture) onSelect(pickerYear, m); }}
              disabled={isFuture}
              className={cn(
                "rounded-lg py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted",
                isFuture && "opacity-30 cursor-not-allowed pointer-events-none",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── notes textarea ───────────────────────────────────────────────────────────

function NotesEditor({
  yearMonth,
  initialNotes,
}: {
  yearMonth: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when yearMonth changes
  useEffect(() => {
    setNotes(initialNotes);
    setSaveState("idle");
  }, [yearMonth, initialNotes]);

  const save = useCallback(async (value: string) => {
    setSaveState("saving");
    try {
      await fetch(`/api/journal/${yearMonth}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("idle");
    }
  }, [yearMonth]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setNotes(val);
    setSaveState("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(val), 600);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Monthly Notes</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground h-5">
          {saveState === "saving" && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Saving…
            </span>
          )}
          {saveState === "saved" && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Save className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder="Summarize the month — market conditions, what worked, what didn't, key decisions, and lessons to carry forward."
        className="w-full min-h-[180px] rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
      />
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function JournalPageContent() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based
  const [uiPortfolioId, setUiPortfolioId] = useState("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const yearMonth = toYearMonth(year, month);
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  // Reset selected date when month changes
  useEffect(() => { setSelectedDate(null); }, [yearMonth]);

  // Portfolios for filter pills
  const { data: portfolios = [] } = useSWR<Portfolio[]>("/api/portfolios", fetcher);

  // Journal data
  const swrKey = `${uiPortfolioId === "all" ? "" : `&portfolioId=${uiPortfolioId}`}`;
  const { data, isLoading } = useSWR<JournalResponse>(
    `/api/journal/${yearMonth}?${swrKey}`,
    fetcher,
  );

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    const nextY = month === 12 ? year + 1 : year;
    const nextM = month === 12 ? 1 : month + 1;
    // Allow navigating up to and including the current month; block only true future
    const isFuture = nextY > now.getFullYear() || (nextY === now.getFullYear() && nextM > now.getMonth() + 1);
    if (!isFuture) { setYear(nextY); setMonth(nextM); }
  }

  // Disable the next chevron only when already on the current month
  const isFutureOrCurrent = year > now.getFullYear() ||
    (year === now.getFullYear() && month >= now.getMonth() + 1);

  const days = data?.days ?? {};
  const stats = data?.monthStats;
  const selectedTrades = selectedDate ? (days[selectedDate]?.trades ?? []) : [];

  const monthPnlColor = useMemo(() => moneyColor(stats?.totalPnl ?? 0), [stats?.totalPnl]);

  return (
    <div className="py-6 px-4 sm:px-6 space-y-5 max-w-4xl mx-auto">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        style={{ willChange: "opacity, transform" }}
      >
        <h1 className="text-2xl font-bold text-foreground">Trade Journal</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Monthly review — calendar, stats, and notes</p>
      </motion.div>

      {/* Month nav + Portfolio filter */}
      <motion.div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between relative z-10"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.04 }}
        style={{ willChange: "opacity, transform" }}
      >
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="text-base font-semibold text-foreground min-w-[148px] hover:text-primary transition-colors"
            >
              {monthLabel}
            </button>
            {pickerOpen && (
              <MonthPicker
                activeYear={year}
                activeMonth={month}
                maxYear={now.getFullYear()}
                maxMonth={now.getMonth() + 1}
                onSelect={(y, m) => { setYear(y); setMonth(m); setPickerOpen(false); }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
          <button
            onClick={nextMonth}
            disabled={isFutureOrCurrent}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {/* Jump to current month */}
          {!(year === now.getFullYear() && month === now.getMonth() + 1) && (
            <button
              onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}
              className="text-xs text-primary hover:underline ml-1"
            >
              Today
            </button>
          )}
        </div>

        {/* Portfolio filter pills */}
        {portfolios.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {[{ id: "all", name: "All Portfolios" }, ...portfolios].map((p) => (
              <button
                key={p.id}
                onClick={() => setUiPortfolioId(p.id)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full border transition-all",
                  uiPortfolioId === p.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats strip */}
          {stats && stats.tradeCount > 0 && (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.08 }}
              style={{ willChange: "opacity, transform" }}
            >
              <div className="rounded-xl border bg-card p-4 space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Month P/L</p>
                <p className={cn("text-xl font-bold tabular-nums", monthPnlColor)}>
                  {stats.totalPnl >= 0 ? "+" : ""}{formatUSD(stats.totalPnl)}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4 space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Win Rate</p>
                <p className={cn("text-xl font-bold tabular-nums", stats.winRate != null && stats.winRate >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                  {stats.winRate != null ? `${stats.winRate.toFixed(0)}%` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">{stats.tradeCount} trade{stats.tradeCount !== 1 ? "s" : ""} closed</p>
              </div>
              <div className="rounded-xl border bg-card p-4 space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Best Day</p>
                <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {stats.bestDay ? `+${formatUSD(stats.bestDay.pnl)}` : "—"}
                </p>
                {stats.bestDay && (
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(stats.bestDay.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
              <div className="rounded-xl border bg-card p-4 space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Worst Day</p>
                <p className={cn("text-xl font-bold tabular-nums", stats.worstDay && stats.worstDay.pnl < 0 ? "text-red-500 dark:text-red-400" : "text-foreground")}>
                  {stats.worstDay ? formatUSD(stats.worstDay.pnl) : "—"}
                </p>
                {stats.worstDay && (
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(stats.worstDay.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Calendar + day panel */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.12 }}
            style={{ willChange: "opacity, transform" }}
            className="space-y-3"
          >
            <Card className="rounded-xl">
              <CardContent className="p-4 sm:p-5">
                {Object.keys(days).length === 0 && !isLoading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No closed trades in {monthLabel}.
                  </div>
                ) : (
                  <CalendarGrid
                    year={year}
                    month={month}
                    days={days}
                    selectedDate={selectedDate}
                    onSelect={(d) => setSelectedDate(d || null)}
                  />
                )}
              </CardContent>
            </Card>

            {selectedDate && selectedTrades.length > 0 && (
              <DayPanel
                date={selectedDate}
                trades={selectedTrades}
                onClose={() => setSelectedDate(null)}
              />
            )}
          </motion.div>

          {/* Notes */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.16 }}
            style={{ willChange: "opacity, transform" }}
          >
            <NotesEditor
              key={yearMonth}
              yearMonth={yearMonth}
              initialNotes={data?.notes ?? ""}
            />
          </motion.div>
        </>
      )}
    </div>
  );
}
