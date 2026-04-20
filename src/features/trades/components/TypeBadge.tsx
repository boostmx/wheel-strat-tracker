export function TypeBadge({ type }: { type: string }) {
  const t = type.toLowerCase().replace(/[\s_-]/g, "");
  const isCSP = t === "cashsecuredput" || t === "csp";
  const isCC = t === "coveredcall" || t === "cc";
  const isPut = t === "put";
  const isCall = t === "call";

  const cls = isCSP
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    : isCC
      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
      : isPut
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : isCall
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-muted text-muted-foreground";

  const label = isCSP ? "CSP" : isCC ? "CC" : isPut ? "Put" : isCall ? "Call" : type;

  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cls}`}>
      {label}
    </span>
  );
}
