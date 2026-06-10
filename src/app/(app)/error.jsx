"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    console.error("App error caught:", error);
    // Redirect ke login dengan membawa pesan error
    const errorMsg = encodeURIComponent(
      error?.message || "Terjadi kesalahan server. Silakan login kembali."
    );
    router.push(`/auth/login?error=${errorMsg}`);
  }, [error, router]);

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0073EA] mx-auto mb-4" />
        <p className="text-[#676879] text-sm">Mengalihkan ke halaman login...</p>
      </div>
    </div>
  );
}
