"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { login, signOut } from "@/app/actions/auth";
import { Briefcase, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const redirectTo = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "auth_callback_error") {
        setError("Gagal verifikasi login. Silakan coba lagi.");
      } else if (errorParam === "session_expired") {
        setError("Sesi Anda telah berakhir. Silakan login kembali.");
      } else {
        setError(decodeURIComponent(errorParam));
      }
    }
  }, [searchParams]);

  const mapError = (message) => {
    const msg = (message || "").toLowerCase();
    if (msg.includes("invalid login credentials") || msg.includes("invalid email or password")) {
      return "Email atau password salah.";
    }
    if (msg.includes("email not confirmed")) {
      return "Email belum dikonfirmasi. Cek inbox Anda.";
    }
    return message;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email.trim(), password);

      if (result.error) {
        setError(mapError(result.error));
        setLoading(false);
        return;
      }

      // Login berhasil — invalidate cache & refresh halaman tujuan
      queryClient.invalidateQueries();
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      console.error("Login error:", err);
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] rounded-xl flex items-center justify-center shadow-md">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-[#323338] text-2xl">Tuesday.com</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E1E5F3] p-8">
          <h1 className="text-2xl font-bold text-[#323338] mb-1">
            Selamat datang kembali
          </h1>
          <p className="text-[#676879] text-sm mb-6">
            Masuk ke akun Anda untuk melanjutkan
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#323338] mb-1.5">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="nama@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border-[#E1E5F3] rounded-xl h-11 px-4 focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#323338] mb-1.5">Password</label>
              <Input
                id="password"
                type="password"
                placeholder="Masukkan password Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full border-[#E1E5F3] rounded-xl h-11 px-4 focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#0073EA] to-[#0056B3] hover:from-[#0056B3] hover:to-[#0073EA] text-white rounded-xl h-11 font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </span>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-[#676879] mt-6">
            Belum punya akun?{" "}
            <Link href="/auth/signup" className="text-[#0073EA] font-medium hover:underline">Daftar</Link>
          </p>

          <div className="mt-6 pt-4 border-t border-[#E1E5F3]">
            <button
              type="button"
              onClick={async () => {
                await signOut();
                window.location.reload();
              }}
              className="w-full text-center text-xs text-[#676879] hover:text-red-500 transition-colors py-2"
            >
              ⚠ Paksa hapus session (dev)
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[#676879] mt-4">
          &copy; {new Date().getFullYear()} Tuesday.com
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0073EA]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
