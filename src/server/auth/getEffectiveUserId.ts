import { cookies } from "next/headers";

/**
 * Returns the userId that should be used for data queries.
 * - For regular users: their own session userId.
 * - For admins: the impersonated userId if set (via cookie), otherwise their own.
 */
export async function getEffectiveUserId(
  userId: string,
  isAdmin: boolean,
): Promise<string> {
  if (!isAdmin) return userId;
  const store = await cookies();
  return store.get("wt-impersonate")?.value ?? userId;
}
