import {
  validateInternalApiKey,
  internalResponse,
  internalError,
} from "@/server/api/internal";
import { db } from "@/server/db";

// GET /api/internal/v1/portfolios?userId=
// Returns the list of portfolios for a user.
// Consumer: hlf-bookkeeping (portfolio filter in settings)
export async function GET(request: Request) {
  if (!validateInternalApiKey(request)) {
    return internalError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return internalError("userId is required", 400);
  }

  try {
    const portfolios = await db.portfolio.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return internalResponse(portfolios);
  } catch (error) {
    console.error("[internal/portfolios] error:", error);
    return internalError("Internal server error", 500);
  }
}
