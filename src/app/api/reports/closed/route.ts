import { prisma } from "@/server/db";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth/auth";
import { getClosedTradesInRange } from "@/features/reports/hooks/getClosedTradesRange";
import type { Trade } from "@/types";

function parseDateOrFallback(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function csvEscape(value: string): string {
  const needsQuotes = /[",\n]/.test(value);
  const v = value.replace(/"/g, '""');
  return needsQuotes ? `"${v}"` : v;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const portfolioId = searchParams.get("portfolioId");
  const format = (searchParams.get("format") ?? "json").toLowerCase();

  // Build list of portfolio IDs to query. If none provided or "all",
  // include all portfolios owned by the authenticated user.
  const portfolioIds: string[] = [];
  if (!portfolioId || portfolioId === "all") {
    const mine = await prisma.portfolio.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });
    for (const p of mine) portfolioIds.push(p.id);
  } else {
    portfolioIds.push(portfolioId);
  }

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const start = parseDateOrFallback(searchParams.get("start"), defaultStart);
  const end = parseDateOrFallback(searchParams.get("end"), now);

  const results = await Promise.all(
    portfolioIds.map((pid) =>
      getClosedTradesInRange({
        portfolioId: pid,
        start,
        end,
        userId: session.user.id,
      }),
    ),
  );
  const rows = results.flat();

  const toDate = (iso: string | null | undefined): Date | null => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  type ReportRow = Trade & {
    premiumReceived: number;
    premiumPaidToClose: number;
    premiumCapturedComputed: number; // computed fallback if premiumCaptured is null
    pctPLOnPremium: number; // computed from received/captured
    holdingDays: number;
    contractsClosed: number; // derived for convenience in CSV/UI
  };

  const enriched: ReportRow[] = rows.map((r) => {
    const contractsInitial = r.contractsInitial ?? r.contracts;
    const contractsOpen = r.contractsOpen ?? 0;
    const contractsClosed = Math.max(0, contractsInitial - contractsOpen);

    const premiumReceived = r.contractPrice * 100 * contractsInitial;
    const exitPerContract = r.closingPrice ?? 0;
    const premiumPaidToClose = exitPerContract * 100 * contractsClosed;

    const premiumCapturedComputed = Math.max(
      0,
      premiumReceived - premiumPaidToClose,
    );
    const premiumCaptured = r.premiumCaptured ?? premiumCapturedComputed;
    const pctPLOnPremium =
      premiumReceived > 0 ? premiumCaptured / premiumReceived : 0;

    const openedAtDate = toDate(r.createdAt);
    const closedAtDate = toDate(r.closedAt);
    const holdingDays =
      openedAtDate && closedAtDate
        ? Math.max(
            0,
            Math.ceil(
              (closedAtDate.getTime() - openedAtDate.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : 0;

    return {
      ...r,
      premiumReceived,
      premiumPaidToClose,
      premiumCapturedComputed,
      pctPLOnPremium,
      holdingDays,
      contractsClosed,
    };
  });

  // Prefer DB values with sensible fallbacks for CSV parity with UI
  const pickPremiumCaptured = (r: ReportRow) =>
    typeof r.premiumCaptured === "number" && Number.isFinite(r.premiumCaptured)
      ? r.premiumCaptured
      : typeof r.premiumCapturedComputed === "number" &&
          Number.isFinite(r.premiumCapturedComputed)
        ? r.premiumCapturedComputed
        : 0;

  const pickPercentPL = (r: ReportRow) =>
    typeof r.percentPL === "number" && Number.isFinite(r.percentPL)
      ? r.percentPL
      : typeof r.pctPLOnPremium === "number" &&
          Number.isFinite(r.pctPLOnPremium)
        ? r.pctPLOnPremium
        : 0;

  // Sort chronologically by Date Closed asc (fallback to createdAt)
  const enrichedSorted = [...enriched].sort((a, b) => {
    const aTime = new Date(a.closedAt ?? a.createdAt).getTime();
    const bTime = new Date(b.closedAt ?? b.createdAt).getTime();
    return aTime - bTime;
  });

  if (format === "csv") {
    // Headers aligned with Reports table (exact order)
    const headers = [
      "createdAt",
      "closedAt",
      "ticker",
      "strikePrice",
      "entryPrice",
      "type",
      "expirationDate",
      "contractsInitial",
      "premiumCaptured",
      "percentPL",
      "notes",
    ];

    const lines: string[] = [];
    lines.push(headers.join(","));

    for (const r of enrichedSorted) {
      const createdAt =
        typeof r.createdAt === "string"
          ? r.createdAt
          : new Date(r.createdAt).toISOString();
      const closedAt = r.closedAt
        ? typeof r.closedAt === "string"
          ? r.closedAt
          : new Date(r.closedAt).toISOString()
        : "";
      const contractsInitial = r.contractsInitial ?? r.contracts ?? 0;

      const line = [
        createdAt,
        closedAt,
        r.ticker ?? "",
        String(r.strikePrice ?? 0),
        r.entryPrice == null ? "" : String(r.entryPrice),
        r.type ?? "",
        typeof r.expirationDate === "string"
          ? r.expirationDate
          : new Date(r.expirationDate).toISOString(),
        String(contractsInitial),
        String(pickPremiumCaptured(r)),
        String(pickPercentPL(r)),
        r.notes ?? "",
      ].map((v) => csvEscape(v));

      lines.push(line.join(","));
    }

    const body = lines.join("\n");
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="closed-trades_${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  // default JSON
  return NextResponse.json({
    range: { start: start.toISOString(), end: end.toISOString() },
    count: enriched.length,
    rows: enriched,
  });
}
