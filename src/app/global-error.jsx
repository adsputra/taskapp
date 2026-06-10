"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("Global root error caught:", error);
    // Global error: redirect via window.location karena router mungkin tidak tersedia
    const errorMsg = encodeURIComponent(
      error?.message || "Terjadi kesalahan server. Silakan login kembali."
    );
    window.location.href = `/auth/login?error=${errorMsg}`;
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0073EA] mx-auto mb-4" />
          <p className="text-[#676879] text-sm">Mengalihkan ke halaman login...</p>
        </div>
      </body>
    </html>
  );
}
