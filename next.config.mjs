/** @type {import('next').NextConfig} */

const supabaseOrigin = (() => {
  try {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return value ? new URL(value).origin : "https://*.supabase.co";
  } catch {
    return "https://*.supabase.co";
  }
})();

const isDevelopment = process.env.NODE_ENV === "development";

// Note: 'unsafe-inline' for scripts is required by Next.js inline bootstrap
// scripts without a nonce setup. Everything else is locked down.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${supabaseOrigin} wss://*.supabase.co`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  // React Strict Mode — aktif di dev, nonaktif di production
  reactStrictMode: process.env.NODE_ENV === "development",

  // Stabilkan module resolution
  serverExternalPackages: ["@supabase/ssr"],

  // Optimasi images dari Supabase storage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },

  // Security headers for every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // TypeScript checking sudah handle sendiri
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
