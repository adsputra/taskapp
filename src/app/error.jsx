"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RootError({ error, reset }) {
  useEffect(() => {
    console.error("Application error caught by boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-100 dark:border-red-900/50">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Terjadi Kesalahan
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {error?.message || "Terjadi kendala saat memuat halaman ini. Silakan coba muat ulang."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => reset()}
            className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-11 px-5 font-medium shadow-md shadow-blue-500/20"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Coba Lagi
          </Button>
          <Link href="/boards">
            <Button
              variant="outline"
              className="w-full sm:w-auto rounded-xl h-11 px-5 border-slate-200 dark:border-slate-700 dark:text-slate-300"
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Ke Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
