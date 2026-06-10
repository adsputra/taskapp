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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let session = null;

  // Hanya coba auth kalau env vars ada
  if (url && key) {
    try {
      let response = NextResponse.next({ request });

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

      const { data } = await supabase.auth.getSession();
      session = data?.session ?? null;
    } catch (e) {
      // Kalau auth gagal (misal env vars salah), treat sebagai tidak login
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
