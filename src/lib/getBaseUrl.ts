export function getBaseUrl() {
  if (typeof window !== "undefined") {
    // Client-side: use window location
    return window.location.origin;
  }

  // Server-side: check env or fallback
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  // Optional: Vercel fallback during SSR (rarely reliable)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Default fallback (dev SSR or CI)
  return "http://localhost:3000";
}