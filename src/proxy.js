import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { requestRateLimiter, getClientIp } from '@/lib/rate-limit';
import { incrementCounter, observeHistogram } from '@/lib/metrics';
import { buildContentSecurityPolicy, createNonce } from '@/lib/csp';

// Signed-out pages: a signed-in user is sent on to the app. Every other
// page needs a session — including /auth/mfa, which acts on the aal1
// session that still needs its second step.
const GUEST_ONLY_ROUTES = ['/auth/login', '/auth/signup'];
const PUBLIC_ROUTES = ['/api/health', '/api/metrics'];

function matches(pathname, routes) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function finalize(response, { requestId, csp }) {
  response.headers.set('x-request-id', requestId);
  if (csp) response.headers.set('Content-Security-Policy', csp);
  return response;
}

function routeLabel(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  if (parts.length === 1) return `/${parts[0]}`;
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[1]);
  return `/${parts[0]}/${isId ? ':id' : parts[1]}`;
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * The user has a verified MFA factor but this session is still aal1.
 * `user` comes from getUser() (validated by Supabase), and the session's
 * access token was just used for that call, so its `aal` claim is current.
 */
async function needsMfaStepUp(supabase, user) {
  const hasVerifiedFactor = (user.factors || []).some((factor) => factor.status === 'verified');
  if (!hasVerifiedFactor) return false;
  const { data: { session } } = await supabase.auth.getSession();
  const claims = session?.access_token ? decodeJwtPayload(session.access_token) : null;
  return claims?.aal !== 'aal2';
}

function redirectTo(request, pathname, { keepPath = false } = {}) {
  const url = request.nextUrl.clone();
  const original = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = pathname;
  url.search = '';
  if (keepPath) url.searchParams.set('redirect', original);
  return NextResponse.redirect(url);
}

export async function proxy(request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');

  // Per-request CSP nonce. Next.js reads it from the request header and
  // stamps it on every script it renders.
  const nonce = createNonce();
  const csp = isApi
    ? null
    : buildContentSecurityPolicy({
        nonce,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        isDev: process.env.NODE_ENV === 'development',
      });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  if (csp) {
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);
  }
  const ctx = { requestId, csp };

  const route = routeLabel(pathname);
  incrementCounter('taskapp_http_requests_total', { method: request.method, route });

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Fail closed in production — never serve the app without auth configured.
    if (process.env.NODE_ENV === 'production') {
      incrementCounter('taskapp_auth_config_missing_total');
      return finalize(
        NextResponse.json({ error: 'Server tidak dikonfigurasi.' }, { status: 503 }),
        ctx
      );
    }
    // Dev/build without env: proceed without auth check.
    return finalize(response, ctx);
  }

  if (matches(pathname, PUBLIC_ROUTES)) {
    return finalize(response, ctx);
  }

  const isGuestOnly = matches(pathname, GUEST_ONLY_ROUTES);

  // Basic abuse protection for auth endpoints (server actions POST here).
  if (request.method === 'POST' && pathname.startsWith('/auth')) {
    const result = await requestRateLimiter.check(`auth:${getClientIp(request.headers)}`);
    if (!result.allowed) {
      incrementCounter('taskapp_rate_limit_blocked_total', { scope: 'proxy_auth' });
      return finalize(
        NextResponse.json(
          { error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' },
          {
            status: 429,
            headers: { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) },
          }
        ),
        ctx
      );
    }
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
          requestHeaders.set('cookie', request.cookies.toString());
        });
        response = NextResponse.next({ request: { headers: requestHeaders } });
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

  // Carry refreshed session cookies over to a redirect response.
  const withCookies = (redirect) => {
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return finalize(redirect, ctx);
  };

  if (!user) {
    if (isGuestOnly || pathname === '/auth/callback') return finalize(response, ctx);
    return withCookies(redirectTo(request, '/auth/login', { keepPath: true }));
  }

  const mfaPending = await needsMfaStepUp(supabase, user);

  if (mfaPending && pathname !== '/auth/mfa' && pathname !== '/auth/callback') {
    // The database refuses aal1 sessions of MFA users anyway; send them to
    // the challenge instead of an app full of empty pages.
    return withCookies(redirectTo(request, '/auth/mfa', { keepPath: !isGuestOnly }));
  }

  if (isGuestOnly) {
    return withCookies(redirectTo(request, '/boards'));
  }

  return finalize(response, ctx);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets. Link prefetches skip the proxy:
     * they carry no HTML that needs a nonce.
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
