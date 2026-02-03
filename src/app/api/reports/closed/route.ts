import { prisma } from "@/server/db";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth/auth";
import { getClosedTradesInRange } from "@/features/reports/hooks/getClosedTradesRange";

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
  const tradeRows = results.flat();

  // Also include closed stock lots (share closes) in the same date range.
  // These are normalized into the report row shape so the UI can show Share P/L.
  const closedStockLots = await prisma.stockLot.findMany({
    where: {
      portfolioId: { in: portfolioIds },
      portfolio: { userId: session.user.id },
      status: "CLOSED",
      closedAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      portfolioId: true,
      ticker: true,
      openedAt: true,
      closedAt: true,
      shares: true,
      avgCost: true,
      closePrice: true,
      realizedPnl: true,
      notes: true,
    },
    orderBy: { closedAt: "desc" },
  });

  type NormalizedStockLotRow = {
    id: string;
    portfolioId: string;
    ticker: string;
    createdAt: Date;
    closedAt: Date;

    // For Share P/L calculations in the UI
    entryPrice: number;
    stockExitPrice: number;

    // Used by the API to derive sharesClosed
    sharesInitial: number;
    sharesOpen: number;

    // Optional convenience fields
    realizedPnl: number | null;

    // Fill trade-ish fields with safe defaults.
    type: string;
    strikePrice: number;
    expirationDate: Date;
    contractPrice: number;
    contracts: number;
    contractsInitial: number;
    contractsOpen: number;
    closingPrice: number | null;
    premiumCaptured: number | null;
    percentPL: number | null;
    notes: string | null;
  };

  const normalizedStockLotRows: NormalizedStockLotRow[] = closedStockLots
    .filter((s) => s.closedAt)
    .map((s) => ({
      id: s.id,
      portfolioId: s.portfolioId,
      ticker: s.ticker,
      createdAt: s.openedAt,
      closedAt: s.closedAt as Date,

      // Decimal -> number
      entryPrice: Number(s.avgCost),
      stockExitPrice: s.closePrice == null ? 0 : Number(s.closePrice),

      // StockLot has a single shares count when closed.
      sharesInitial: s.shares,
      sharesOpen: 0,

      realizedPnl: s.realizedPnl == null ? null : Number(s.realizedPnl),

      // Normalize into Trade-like shape so we can reuse the report pipeline.
      type: "STOCK_LOT",
      strikePrice: 0,
      expirationDate: (s.closedAt as Date),
      contractPrice: 0,
      contracts: 0,
      contractsInitial: 0,
      contractsOpen: 0,
      closingPrice: null,
      premiumCaptured: 0,
      percentPL: null,
      notes: s.notes ?? null,
    }));

  type ReportSourceRow = Record<string, unknown> & {
    id: string;
    portfolioId: string;
    ticker: string;

    // Dates
    createdAt: Date | string;
    closedAt?: Date | string | null;
    expirationDate: Date | string;

    // Trade-ish fields (optional for stock lots)
    type?: string;
    strikePrice?: number;
    entryPrice?: number | null;

    contractPrice?: number;
    contracts?: number;
    contractsInitial?: number;
    contractsOpen?: number;

    closingPrice?: number | null;
    premiumCaptured?: number | null;
    percentPL?: number | null;

    notes?: string | null;
  };

  type ReportRow = ReportSourceRow & {
    premiumReceived: number;
    premiumPaidToClose: number;
    premiumCapturedComputed: number; // computed fallback if premiumCaptured is null
    pctPLOnPremium: number; // computed from received/captured
    holdingDays: number;
    contractsClosed: number; // derived for convenience in CSV/UI
    sharesClosed: number; // derived for convenience in CSV/UI
  };

  const allRows: ReportSourceRow[] = [
    ...(tradeRows as unknown as ReportSourceRow[]),
    ...(normalizedStockLotRows as unknown as ReportSourceRow[]),
  ];

  const toDate = (value: Date | string | null | undefined): Date | null => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getOptionalNumber = (
    obj: unknown,
    key: string,
  ): number | null => {
    if (!obj || typeof obj !== "object") return null;
    const rec = obj as Record<string, unknown>;
    const v = rec[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const computeSharesClosed = (
    row: Record<string, unknown>,
    contractsClosed: number,
  ): number => {
    // If the Trade row includes share-lot fields, prefer those.
    // Otherwise, fall back to options convention: 100 shares per contract.
    const sharesInitial =
      getOptionalNumber(row, "sharesInitial") ?? getOptionalNumber(row, "shares");
    const sharesOpen =
      getOptionalNumber(row, "sharesOpen") ?? getOptionalNumber(row, "sharesRemaining");

    if (typeof sharesInitial === "number") {
      const open = typeof sharesOpen === "number" ? sharesOpen : 0;
      return Math.max(0, sharesInitial - open);
    }

    return Math.max(0, contractsClosed * 100);
  };

  const enriched: ReportRow[] = allRows.map((r) => {
    const contractsInitial = (r.contractsInitial ?? r.contracts ?? 0);
    const contractsOpen = r.contractsOpen ?? 0;
    const contractsClosed = Math.max(0, contractsInitial - contractsOpen);
    const sharesClosed = computeSharesClosed(r as Record<string, unknown>, contractsClosed);

    const contractPrice = r.contractPrice ?? 0;
    const premiumReceived = contractPrice * 100 * contractsInitial;
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
      sharesClosed,
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
      "sharesClosed",
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
        String(r.sharesClosed ?? 0),
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
