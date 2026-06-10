import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Creates a Supabase client for use in Next.js middleware.
 * This function refreshes the auth session and returns a response
 * with updated cookies.
 *
 * Returns { supabase, response } — the caller must return `response`
 * from the middleware to propagate cookie changes.
 */
export async function createMiddlewareClient(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return {
      supabase: null,
      response: NextResponse.next({ request }),
    };
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Terapkan cookie ke request (untuk pemrosesan selanjutnya)
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        // Buat response baru dengan cookie yang diperbarui
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Panggil getUser untuk memicu refresh token jika diperlukan
  // Ini tidak melempar error jika tidak ada user — aman
  try {
    await supabase.auth.getUser();
  } catch (_) {
    // Abaikan error — user tidak terautentikasi
  }

  return { supabase, response };
}
