import {
  validateInternalApiKey,
  internalResponse,
  internalError,
} from "@/server/api/internal";
import { db } from "@/server/db";

// GET /api/internal/v1/portfolios?userId=   (HLF suite apps — shared DB)
// GET /api/internal/v1/portfolios?email=    (hlf-wheel-alerts — separate DB, lookup by email)
// Returns the list of portfolios for a user.
// Consumer: hlf-bookkeeping (portfolio filter in settings), hlf-wheel-alerts (portfolio switcher)
export async function GET(request: Request) {
  if (!validateInternalApiKey(request)) {
    return internalError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const email = searchParams.get("email");

  if (!userId && !email) {
    return internalError("userId or email is required", 400);
  }

  let resolvedUserId = userId;
  if (!resolvedUserId && email) {
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return internalResponse([]);
    resolvedUserId = user.id;
  }

  try {
    const portfolios = await db.portfolio.findMany({
      where: { userId: resolvedUserId! },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return internalResponse(portfolios);
  } catch (error) {
    console.error("[internal/portfolios] error:", error);
    return internalError("Internal server error", 500);
  }
}
