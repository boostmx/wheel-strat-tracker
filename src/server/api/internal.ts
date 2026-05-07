import { NextResponse } from "next/server";

export function validateInternalApiKey(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice(7);
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected || provided !== expected) return false;
  return true;
}

export function internalResponse<T>(
  data: T,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({
    data,
    meta: {
      version: "v1",
      requestedAt: new Date().toISOString(),
      ...extra,
    },
  });
}

export function internalError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
