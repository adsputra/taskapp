/** @type {import('next').NextConfig} */

// Content-Security-Policy is NOT set here: it needs a fresh nonce per
// request, so src/proxy.js builds it (see src/lib/csp.js).
const securityHeaders = [
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
