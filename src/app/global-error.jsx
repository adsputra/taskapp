"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("Critical root error caught:", error);
  }, [error]);

  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans text-slate-800">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-100 font-bold text-2xl">
            !
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Terjadi Kesalahan Sistem
          </h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            {error?.message || "Aplikasi mengalami kendala kritis. Silakan muat ulang halaman."}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-11 px-5 font-medium shadow-md shadow-blue-500/20 cursor-pointer"
            >
              Muat Ulang
            </button>
            <Link
              href="/boards"
              className="inline-flex items-center justify-center rounded-xl h-11 px-5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
