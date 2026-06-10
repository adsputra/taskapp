/** @type {import('next').NextConfig} */
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

  // TypeScript checking sudah handle sendiri
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
