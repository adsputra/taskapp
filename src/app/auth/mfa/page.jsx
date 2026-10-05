"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { mfaApi } from "@/lib/api/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthShell, { AuthAlert, AuthFallback, authButtonClass, authInputClass } from "@/components/auth/AuthShell";
import { safeRedirectPath } from "@/lib/validation";

/**
 * Second step of sign-in for users with an authenticator app. Until this
 * succeeds the session is aal1 and the database serves no data to it.
 */
function MfaChallenge() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const redirectTo = safeRedirectPath(searchParams.get("redirect"));

  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const { data: factors = [], isLoading } = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: () => mfaApi.listFactors(),
  });
  const factor = factors.find((f) => f.status === "verified");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!factor) return;
    setError(null);
    setVerifying(true);
    try {
      await mfaApi.verify(factor.id, code);
      queryClient.invalidateQueries();
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err.message);
      setCode("");
      setVerifying(false);
    }
  };

  const useAnotherAccount = async () => {
    await signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <AuthShell
      headline="Verifikasi dua langkah"
      subline="Akun Anda dilindungi aplikasi authenticator."
      title="Masukkan kode"
      description="Buka aplikasi authenticator Anda dan masukkan kode 6 digit untuk Tuesday."
      footer={
        <button type="button" onClick={useAnotherAccount} className="font-semibold text-primary hover:text-primary/80">
          Keluar dan gunakan akun lain
        </button>
      }
    >
      <AuthAlert>{error}</AuthAlert>

      {isLoading ? (
        <div className="flex justify-center py-8" role="status" aria-label="Loading">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !factor ? (
        <AuthAlert>Tidak ada authenticator aktif untuk akun ini. Keluar lalu login kembali.</AuthAlert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="code" className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Kode dari {factor.friendly_name || "authenticator"}
            </label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoFocus
              className={`${authInputClass} text-center text-2xl tracking-[0.5em] font-semibold`}
            />
          </div>
          <Button type="submit" disabled={verifying || code.length !== 6} className={authButtonClass}>
            {verifying ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Memverifikasi...
              </span>
            ) : (
              "Verifikasi"
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function MfaPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <MfaChallenge />
    </Suspense>
  );
}
