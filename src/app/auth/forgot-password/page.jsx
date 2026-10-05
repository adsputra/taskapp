"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthShell, { AuthAlert, authButtonClass, authInputClass } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sentTo, setSentTo] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await requestPasswordReset(email.trim());
      if (result.error) setError(result.error);
      else setSentTo(email.trim());
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
    }
    setLoading(false);
  };

  return (
    <AuthShell
      headline="Lupa password?"
      subline="Kami kirim link untuk membuat password baru ke email Anda."
      title="Reset password"
      description="Masukkan email akun Anda."
      footer={
        <Link href="/auth/login" className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary/80">
          <ArrowLeft className="h-4 w-4" /> Kembali ke login
        </Link>
      }
    >
      <AuthAlert>{error}</AuthAlert>

      {sentTo ? (
        <AuthAlert tone="success">
          Jika <strong>{sentTo}</strong> terdaftar, link reset sudah dikirim. Cek inbox (dan folder spam) Anda —
          link berlaku sebentar dan hanya bisa dipakai sekali.
        </AuthAlert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
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
          <Button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Mengirim...
              </span>
            ) : (
              "Kirim link reset"
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
