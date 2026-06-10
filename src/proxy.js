import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const protectedRoutes = ["/", "/boards", "/analytics"];
const authRoutes = ["/auth/login", "/auth/signup"];

export async function proxy(request) {
  const pathname = request.nextUrl.pathname;

  // Skip aset statis
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Default response — akan dipakai kalau tidak redirect
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let session = null;

  // Coba dapatkan session hanya kalau env vars tersedia
  if (url && key) {
    try {
      const supabase = createServerClient(url, key, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      });

      // Timeout 5 detik — cegah hanging request ke Supabase
      const timeout = new Promise((resolve) =>
        setTimeout(() => resolve({ data: { session: null } }), 5000)
      );

      const { data } = await Promise.race([
        supabase.auth.getSession(),
        timeout,
      ]);
      session = data?.session ?? null;
    } catch {
      // Auth gagal — treat sebagai tidak login, tetap lanjut
      session = null;
    }
  }

  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  const isAuthRoute = authRoutes.some((route) => pathname === route);

  // Tidak login → akses rute protected → redirect login
  if (!session && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Sudah login → akses rute auth → redirect dashboard
  if (session && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
