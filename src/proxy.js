import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { requestRateLimiter, getClientIp } from '@/lib/rate-limit';
import { incrementCounter, observeHistogram } from '@/lib/metrics';

function withRequestId(response, requestId) {
  response.headers.set('x-request-id', requestId);
  return response;
}

function routeLabel(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  if (parts.length === 1) return `/${parts[0]}`;
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[1]);
  return `/${parts[0]}/${isId ? ':id' : parts[1]}`;
}

export async function proxy(request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  request.headers.set('x-request-id', requestId);

  const route = routeLabel(request.nextUrl.pathname);
  incrementCounter('taskapp_http_requests_total', { method: request.method, route });

  // Create an unmodified response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Fail closed in production — never serve the app without auth configured.
    if (process.env.NODE_ENV === 'production') {
      incrementCounter('taskapp_auth_config_missing_total');
      return withRequestId(
        NextResponse.json({ error: 'Server tidak dikonfigurasi.' }, { status: 503 }),
        requestId
      );
    }
    // Dev/build without env: proceed without auth check.
    return withRequestId(response, requestId);
  }

  const url = request.nextUrl.clone();
  const isAuthRoute = url.pathname.startsWith('/auth');
  const isPublicRoute =
    url.pathname === '/' ||
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/favicon.ico') ||
    url.pathname === '/api/health' ||
    url.pathname === '/api/metrics';

  // Basic abuse protection for auth endpoints (server actions POST here).
  if (!isPublicRoute && request.method === 'POST' && isAuthRoute) {
    const result = await requestRateLimiter.check(`auth:${getClientIp(request.headers)}`);
    if (!result.allowed) {
      incrementCounter('taskapp_rate_limit_blocked_total', { scope: 'proxy_auth' });
      return withRequestId(
        NextResponse.json(
          { error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' },
          {
            status: 429,
            headers: { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) },
          }
        ),
        requestId
      );
    }
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session if expired
  const authStartedAt = Date.now();
  const { data: { user } } = await supabase.auth.getUser();
  observeHistogram('taskapp_supabase_auth_check_duration_ms', Date.now() - authStartedAt, {
    route,
  });

  // If user is not logged in and tries to access a private route
  if (!user && !isAuthRoute && !isPublicRoute) {
    const originalPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.pathname = '/auth/login';
    url.search = '';
    url.searchParams.set('redirect', originalPath);
    return withRequestId(NextResponse.redirect(url), requestId);
  }

  // If user is logged in and tries to access login/signup pages
  if (user && isAuthRoute) {
    url.pathname = '/boards'; // Redirect to dashboard/boards
    url.search = '';
    return withRequestId(NextResponse.redirect(url), requestId);
  }

  return withRequestId(response, requestId);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
