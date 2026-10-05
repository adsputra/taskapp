"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary: replaces the root layout, so it brings its own
 * <html>/<body> and stylesheet. The raw error message is not shown — it
 * can contain internals; the digest lets support find it in the logs.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("Critical root error caught:", error);
  }, [error]);

  return (
    <html lang="id">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 font-sans text-foreground">
        <main className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-2xl font-bold text-destructive">
            !
          </div>
          <h1 className="mb-2 text-xl font-bold">Terjadi Kesalahan Sistem</h1>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            Aplikasi mengalami kendala kritis. Silakan muat ulang halaman.
            {error?.digest && (
              <span className="mt-2 block font-mono text-xs text-subtle-foreground">Kode: {error.digest}</span>
            )}
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="h-11 cursor-pointer rounded-xl bg-primary px-5 font-medium text-primary-foreground shadow-md hover:bg-primary/90"
            >
              Muat Ulang
            </button>
            {/* A plain link: the router may be what crashed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/boards"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-5 font-medium text-foreground hover:bg-muted"
            >
              Dashboard
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
