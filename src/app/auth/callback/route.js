import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { safeRedirectPath } from "@/lib/validation";

/**
 * Landing point for every Supabase email/OAuth link (signup confirmation,
 * password recovery, Google/GitHub sign-in). Exchanges the one-time code
 * for a session cookie, then continues to a same-origin `next` path.
 * Profiles are created by the handle_new_user trigger.
 */
export async function GET(request) {
  const requestUrl = new URL(request.url);
  const { origin } = requestUrl;
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"), "/boards");

  const loginWithError = (message) =>
    NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(message)}`);

  const providerError = requestUrl.searchParams.get("error_description");
  if (providerError) return loginWithError("Login dibatalkan atau ditolak penyedia.");
  if (!code) return loginWithError("Kode verifikasi tidak ditemukan.");

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.warn("auth callback exchange failed", { code: error.code });
      return loginWithError("Link sudah kedaluwarsa atau tidak valid. Coba lagi.");
    }

    return NextResponse.redirect(`${origin}${next}`);
  } catch (err) {
    logger.error("auth callback failed", { detail: err?.message });
    return loginWithError("Terjadi kesalahan server.");
  }
}
