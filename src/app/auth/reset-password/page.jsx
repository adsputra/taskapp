"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signOut, updatePassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthShell, { AuthAlert, authButtonClass, authInputClass } from "@/components/auth/AuthShell";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation";

/**
 * Reached from the recovery email: /auth/callback has already turned the
 * link into a (recovery) session, and the proxy requires that session.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    setLoading(true);
    try {
      const result = await updatePassword(password);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      // Start clean: every device has to use the new password.
      await signOut();
      router.replace("/auth/login?reset=1");
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
      setLoading(false);
    }
  };

  return (
    <AuthShell
      headline="Buat password baru"
      subline="Gunakan password yang belum pernah Anda pakai di tempat lain."
      title="Password baru"
      description={`Minimal ${PASSWORD_MIN_LENGTH} karakter.`}
    >
      <AuthAlert>{error}</AuthAlert>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-foreground">
            Password baru
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            className={authInputClass}
          />
        </div>
        <div>
          <label htmlFor="confirm" className="mb-2 block text-sm font-medium text-foreground">
            Ulangi password baru
          </label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            className={authInputClass}
          />
        </div>
        <Button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Menyimpan...
            </span>
          ) : (
            "Simpan password"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
