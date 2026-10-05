/**
 * Public origin of the app for links that leave the browser (emails,
 * auth redirects). Server-only.
 *
 * NEXT_PUBLIC_SITE_URL wins. The request's Host header is only a fallback
 * where it cannot be abused: in development, or for Supabase auth
 * redirects (Supabase rejects any redirect not on its allow-list).
 */
import { headers } from "next/headers";

export async function getSiteOrigin({ allowRequestOrigin = false } = {}) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through
    }
  }

  if (process.env.NODE_ENV === "production" && !allowRequestOrigin) return null;

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  const proto = headerStore.get("x-forwarded-proto") === "https" ? "https" : "http";
  return `${proto}://${host}`;
}
