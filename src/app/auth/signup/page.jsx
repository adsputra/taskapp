"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { signup, signOut } from "@/app/actions/auth";
import { Briefcase, MailCheck, AlertCircle, Loader2, LayoutGrid, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

export default function SignupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  // Force light mode on auth pages
  useEffect(() => {
    const prev = theme;
    setTheme("light");
    return () => { if (prev && prev !== "light") setTheme(prev); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const validateForm = () => {
    if (!fullName.trim()) { setError("Nama lengkap wajib diisi."); return false; }
    if (!email.trim()) { setError("Email wajib diisi."); return false; }
    if (password.length < 6) { setError("Password minimal 6 karakter."); return false; }
    return true;
  };

  const mapError = (message) => {
    const msg = (message || "").toLowerCase();
    if (msg.includes("already registered") || msg.includes("already exists") ||
        msg.includes("duplicate") || msg.includes("unique") || msg.includes("user already") ||
        msg.includes("sudah terdaftar")) {
      return "Email ini sudah terdaftar. Silakan login.";
    }
    if (msg.includes("password")) return "Password terlalu lemah. Gunakan minimal 6 karakter.";
    return message;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validateForm()) return;
    setLoading(true);

    try {
      const result = await signup(fullName.trim(), email.trim(), password);

      if (result.error) {
        setError(mapError(result.error));
        setLoading(false);
        return;
      }

      if (result.emailConfirmationRequired) {
        setRegisteredEmail(email.trim());
        setSuccess(true);
        setLoading(false);
        return;
      }

      queryClient.invalidateQueries();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Signup error:", err);
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
      setLoading(false);
    }
  };

  const features = [
    { icon: LayoutGrid, text: "Kelola proyek dengan board interaktif" },
    { icon: Users, text: "Kolaborasi tim secara real-time" },
    { icon: BarChart3, text: "Pantau progres dengan analitik" },
  ];

  if (success) {
    return (
      <div className="min-h-screen flex">
        {/* Left Panel */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0073EA] to-[#0056B3] relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full -mr-48 -mb-48" />
          <div className="relative z-10 flex flex-col justify-between p-12 w-full">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-white text-2xl">Tuesday.com</span>
            </Link>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-white">
                Verifikasi email Anda
              </h1>
              <p className="text-lg text-white/70 max-w-md">
                Kami telah mengirim link konfirmasi ke email Anda.
              </p>
            </div>
            <p className="text-white/50 text-sm">
              &copy; {new Date().getFullYear()} Tuesday.com
            </p>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-slate-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/25"
              >
                <MailCheck className="w-10 h-10 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">Cek email Anda</h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Kami mengirim link konfirmasi ke{" "}
                <strong className="text-slate-700">{registeredEmail}</strong>.
                Klik link tersebut untuk mengaktifkan akun Anda.
              </p>
              <Link href="/auth/login">
                <Button className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-12 px-8 font-medium shadow-lg shadow-blue-500/25">
                  Ke halaman login
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0073EA] to-[#0056B3] relative overflow-hidden"
      >
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full -mr-48 -mb-48" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-white/5 rounded-full" />
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-white text-2xl">Tuesday.com</span>
          </Link>

          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                Mulai perjalanan<br />
                <span className="text-white/80">produktivitas Anda</span>
              </h1>
              <p className="text-lg text-white/70 max-w-md">
                Buat akun gratis dan mulai kelola proyek dengan cara yang lebih baik.
              </p>
            </div>

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

          <div className="mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-800">
              Buat akun baru
            </h2>
            <p className="text-slate-500 mt-2">
              Mulai dengan akun gratis Anda
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-600 text-sm">{error}</p>
                {error.toLowerCase().includes("sudah terdaftar") && (
                  <Link href="/auth/login" className="text-[#0073EA] text-sm font-medium hover:underline mt-1 inline-block">
                    Ke halaman login →
                  </Link>
                )}
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-2">
                Nama lengkap
              </label>
              <Input 
                id="fullName" 
                type="text" 
                placeholder="Nama Anda" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)} 
                required 
                autoComplete="name"
                className="w-full h-12 px-4 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] transition-all" 
              />
            </div>
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
                placeholder="Buat password (min. 6 karakter)" 
                value={password}
                onChange={(e) => setPassword(e.target.value)} 
                required 
                minLength={6} 
                autoComplete="new-password"
                className="w-full h-12 px-4 rounded-xl border-slate-200 bg-white focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA] transition-all" 
              />
              <p className="text-xs text-slate-400 mt-1.5">Minimal 6 karakter</p>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-12 bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Membuat akun...
                </span>
              ) : (
                "Buat akun"
              )}
            </Button>
          </form>

          <p className="text-center text-slate-500 mt-8">
            Sudah punya akun?{" "}
            <Link href="/auth/login" className="text-[#0073EA] font-semibold hover:text-[#0056B3] transition-colors">
              Masuk
            </Link>
          </p>

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
