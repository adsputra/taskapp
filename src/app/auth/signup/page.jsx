"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, MailCheck } from "lucide-react";
import { signup } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthShell, { AuthAlert, AuthFallback, authButtonClass, authInputClass } from "@/components/auth/AuthShell";
import OAuthButtons from "@/components/auth/OAuthButtons";
import { PASSWORD_MIN_LENGTH, safeRedirectPath } from "@/lib/validation";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const redirectTo = safeRedirectPath(searchParams.get("redirect"));
  const hasCustomRedirect = redirectTo !== "/boards";
  const loginHref = hasCustomRedirect
    ? `/auth/login?redirect=${encodeURIComponent(redirectTo)}`
    : "/auth/login";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState(null);

  const validate = () => {
    if (!fullName.trim()) return "Nama lengkap wajib diisi.";
    if (!email.trim()) return "Email wajib diisi.";
    if (password.length < PASSWORD_MIN_LENGTH) return `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
    return null;
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    const problem = validate();
    setError(problem);
    if (problem) return;
    setLoading(true);

    try {
      const result = await signup(fullName.trim(), email.trim(), password);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (result.emailConfirmationRequired) {
        setRegisteredEmail(email.trim());
        setLoading(false);
        return;
      }

      queryClient.invalidateQueries();
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
      setLoading(false);
    }
  };

  if (registeredEmail) {
    return (
      <AuthShell
        headline="Verifikasi email Anda"
        subline="Kami telah mengirim link konfirmasi ke email Anda."
        title="Cek email Anda"
      >
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.15 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/15"
          >
            <MailCheck className="h-10 w-10 text-success" />
          </motion.div>
          <p className="mb-8 leading-relaxed text-muted-foreground">
            Kami mengirim link konfirmasi ke <strong className="text-foreground">{registeredEmail}</strong>. Klik
            link tersebut untuk mengaktifkan akun Anda.
          </p>
          <Button asChild className={authButtonClass}>
            <Link href={loginHref}>Ke halaman login</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      headline={
        <>
          Mulai perjalanan
          <br />
          <span className="text-white/80">produktivitas Anda</span>
        </>
      }
      subline="Buat akun gratis dan mulai kelola proyek dengan cara yang lebih baik."
      title="Buat akun baru"
      description="Mulai dengan akun gratis Anda"
      footer={
        <>
          Sudah punya akun?{" "}
          <Link href={loginHref} className="font-semibold text-primary transition-colors hover:text-primary/80">
            Masuk
          </Link>
        </>
      }
    >
      <AuthAlert>{error}</AuthAlert>

      <div className="mb-5">
        <OAuthButtons redirectTo={redirectTo} onError={setError} />
      </div>

      <form onSubmit={handleSignup} className="space-y-5">
        <div>
          <label htmlFor="fullName" className="mb-2 block text-sm font-medium text-foreground">
            Nama lengkap
          </label>
          <Input
            id="fullName"
            type="text"
            placeholder="Nama Anda"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
            className={authInputClass}
          />
        </div>
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
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-foreground">
            Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder={`Buat password (min. ${PASSWORD_MIN_LENGTH} karakter)`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            aria-describedby="password-hint"
            className={authInputClass}
          />
          <p id="password-hint" className="mt-1.5 text-xs text-subtle-foreground">
            Minimal {PASSWORD_MIN_LENGTH} karakter
          </p>
        </div>

        <Button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Membuat akun...
            </span>
          ) : (
            "Buat akun"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <SignupForm />
    </Suspense>
  );
}
