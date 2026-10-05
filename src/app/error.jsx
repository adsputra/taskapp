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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
        <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto mb-5 border border-destructive/20">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          Terjadi Kesalahan
        </h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Terjadi kendala saat memuat halaman ini. Silakan coba muat ulang.
          {error?.digest && (
            <span className="mt-2 block font-mono text-xs text-subtle-foreground">Kode: {error.digest}</span>
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => reset()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11 px-5 font-medium shadow-md shadow-primary/20"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Coba Lagi
          </Button>
          <Link href="/boards">
            <Button
              variant="outline"
              className="w-full sm:w-auto rounded-xl h-11 px-5 border-border"
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
