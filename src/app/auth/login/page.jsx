"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { login, signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthShell, { AuthAlert, AuthFallback, authButtonClass, authInputClass } from "@/components/auth/AuthShell";
import OAuthButtons from "@/components/auth/OAuthButtons";
import { safeRedirectPath } from "@/lib/validation";

const KNOWN_ERRORS = {
  auth_callback_error: "Gagal verifikasi login. Silakan coba lagi.",
  session_expired: "Sesi Anda telah berakhir. Silakan login kembali.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const redirectTo = safeRedirectPath(searchParams.get("redirect"));
  const hasCustomRedirect = redirectTo !== "/boards";
  const errorParam = searchParams.get("error");
  const resetDone = searchParams.get("reset") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorParam ? KNOWN_ERRORS[errorParam] || errorParam : null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email.trim(), password);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      queryClient.invalidateQueries();
      router.push(
        result.mfaRequired
          ? `/auth/mfa?redirect=${encodeURIComponent(redirectTo)}`
          : redirectTo
      );
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
      setLoading(false);
    }
  };

  return (
    <AuthShell
      headline={
        <>
          Kelola pekerjaan
          <br />
          <span className="text-white/80">dengan lebih efisien</span>
        </>
      }
      subline="Platform manajemen proyek yang membantu tim Anda terorganisir dan produktif."
      title="Selamat datang kembali"
      description="Masuk ke akun Anda untuk melanjutkan"
      footer={
        <>
          Belum punya akun?{" "}
          <Link
            href={hasCustomRedirect ? `/auth/signup?redirect=${encodeURIComponent(redirectTo)}` : "/auth/signup"}
            className="font-semibold text-primary transition-colors hover:text-primary/80"
          >
            Daftar sekarang
          </Link>
        </>
      }
    >
      {resetDone && !error && <AuthAlert tone="success">Password berhasil diubah. Silakan masuk.</AuthAlert>}
      <AuthAlert>{error}</AuthAlert>

      <div className="mb-5">
        <OAuthButtons redirectTo={redirectTo} onError={setError} />
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="nama@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={authInputClass}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <Link href="/auth/forgot-password" className="text-sm font-medium text-primary hover:text-primary/80">
              Lupa password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Masukkan password Anda"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={authInputClass}
          />
        </div>

        <Button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Memproses...
            </span>
          ) : (
            "Masuk"
          )}
        </Button>
      </form>

      {process.env.NODE_ENV !== "production" && (
        <div className="mt-8 border-t border-border pt-6">
          <button
            type="button"
            onClick={async () => {
              await signOut();
              window.location.reload();
            }}
            className="w-full py-2 text-center text-xs text-subtle-foreground transition-colors hover:text-destructive"
          >
            ⚠ Paksa hapus session (dev)
          </button>
        </div>
      )}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <LoginForm />
    </Suspense>
  );
}
