import {
  validateInternalApiKey,
  internalResponse,
  internalError,
} from "@/server/api/internal";
import { db } from "@/server/db";

// GET /api/internal/v1/watchlist?email=
// Returns watchlist tickers for a user, looked up by email.
// Consumer: hlf-wheel-alerts (auto-sync subscriptions to watchlist)
export async function GET(request: Request) {
  if (!validateInternalApiKey(request)) {
    return internalError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return internalError("email is required", 400);
  }

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) return internalResponse([]);

    const items = await db.watchlistItem.findMany({
      where: { userId: user.id },
      select: { ticker: true, order: true, createdAt: true },
      orderBy: { order: "asc" },
    });

    return internalResponse(items);
  } catch (error) {
    console.error("[internal/watchlist] error:", error);
    return internalError("Internal server error", 500);
  }
}
