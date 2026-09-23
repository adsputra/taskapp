"use client";

import { Suspense, useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { login, signOut } from "@/app/actions/auth";
import { Briefcase, AlertCircle, Loader2, CheckCircle2, LayoutGrid, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  // Force light mode on auth pages
  useEffect(() => {
    const prev = theme;
    setTheme("light");
    return () => { if (prev && prev !== "light") setTheme(prev); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rawRedirect = searchParams.get("redirect");
  const isSafeRelative =
    Boolean(rawRedirect) &&
    rawRedirect.startsWith("/") &&
    !rawRedirect.startsWith("//") &&
    !rawRedirect.includes("\\");
  const redirectTo = isSafeRelative ? rawRedirect : "/boards";

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

      queryClient.invalidateQueries();
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      console.error("Login error:", err);
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
      setLoading(false);
    }
  };

  const features = [
    { icon: LayoutGrid, text: "Kelola proyek dengan board interaktif" },
    { icon: Users, text: "Kolaborasi tim secara real-time" },
    { icon: BarChart3, text: "Pantau progres dengan analitik" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0073EA] to-[#0056B3] relative overflow-hidden"
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full -mr-48 -mb-48" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-white/5 rounded-full" />
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-white text-2xl">Tuesday.com</span>
          </Link>

          {/* Hero Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                Kelola pekerjaan<br />
                <span className="text-white/80">dengan lebih efisien</span>
              </h1>
              <p className="text-lg text-white/70 max-w-md">
                Platform manajemen proyek yang membantu tim Anda terorganisir dan produktif.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-4">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white/90">{feature.text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-white/50 text-sm">
            &copy; {new Date().getFullYear()} Tuesday.com. All rights reserved.
          </p>
        </div>
      </motion.div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 bg-[#0073EA] rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-slate-800 text-xl">Tuesday.com</span>
            </Link>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-800">
              Selamat datang kembali
            </h2>
            <p className="text-slate-500 mt-2">
              Masuk ke akun Anda untuk melanjutkan
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 text-sm">{error}</p>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
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
                className="w-full h-12 px-4 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Masukkan password Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full h-12 px-4 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] transition-all"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Memproses...
                </span>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-slate-500 mt-8">
            Belum punya akun?{" "}
            <Link
              href={isSafeRelative ? `/auth/signup?redirect=${encodeURIComponent(rawRedirect)}` : "/auth/signup"}
              className="text-[#0073EA] font-semibold hover:text-[#0056B3] transition-colors"
            >
              Daftar sekarang
            </Link>
          </p>

          {/* Dev Tools */}
          {process.env.NODE_ENV !== "production" && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  window.location.reload();
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-red-500 transition-colors py-2"
              >
                ⚠ Paksa hapus session (dev)
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-slate-200 border-t-[#0073EA]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
