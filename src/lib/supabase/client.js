import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client — untuk Client Components.
 *
 * Menggunakan `createBrowserClient` dari `@supabase/ssr`
 * supaya session disimpan di cookie, KONSISTEN dengan:
 * - Server Actions (login/signup/signOut)
 * - Middleware (auth check)
 * - Route Handlers (callback)
 *
 * TIDAK pakai singleton — `createBrowserClient` sudah
 * menangani caching internal dengan baik.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
