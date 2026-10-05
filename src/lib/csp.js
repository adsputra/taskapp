/**
 * Content-Security-Policy builder (pure — used by src/proxy.js and tests).
 *
 * Scripts are allowed only through a per-request nonce + 'strict-dynamic':
 * Next.js stamps the nonce on its own <script> tags when it finds it in the
 * request's CSP header, so no 'unsafe-inline' is needed for scripts.
 * Styles keep 'unsafe-inline' — React/Radix/framer-motion write style
 * attributes, which a nonce cannot cover.
 */

export function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function supabaseOrigins(supabaseUrl) {
  try {
    const url = new URL(supabaseUrl);
    const socket = url.protocol === "http:" ? "ws:" : "wss:";
    return { http: url.origin, socket: `${socket}//${url.host}` };
  } catch {
    return { http: "https://*.supabase.co", socket: "wss://*.supabase.co" };
  }
}

export function buildContentSecurityPolicy({ nonce, supabaseUrl, isDev = false }) {
  if (typeof nonce !== "string" || !/^[A-Za-z0-9+/=]{16,}$/.test(nonce)) {
    throw new Error("CSP nonce must be a base64 string");
  }

  const supabase = supabaseOrigins(supabaseUrl);
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // https: for user avatars hosted anywhere; data:/blob: for the MFA QR
    // code and local file previews.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase.http} ${supabase.socket}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Only when the backend is HTTPS too, or a local http:// Supabase used
  // with `next start` would have its requests upgraded and fail.
  if (!isDev && supabase.http.startsWith("https:")) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}
