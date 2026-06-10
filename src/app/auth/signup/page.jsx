"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup, signOut } from "@/app/actions/auth";
import { Briefcase, MailCheck, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const router = useRouter();
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

      // Email confirmation diperlukan
      if (result.emailConfirmationRequired) {
        setRegisteredEmail(email.trim());
        setSuccess(true);
        setLoading(false);
        return;
      }

      // Langsung login (email confirmation disabled)
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Signup error:", err);
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-[#E1E5F3] p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-[#00C875] to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <MailCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#323338] mb-2">Cek email Anda</h1>
            <p className="text-[#676879] mb-6 leading-relaxed">
              Kami mengirim link konfirmasi ke{" "}
              <strong className="text-[#323338]">{registeredEmail}</strong>.
              Klik link tersebut untuk mengaktifkan akun Anda.
            </p>
            <Link href="/auth/login">
              <Button className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-11 px-6 font-medium">
                Ke halaman login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-[#323338] mb-1">Buat akun baru</h1>
          <p className="text-[#676879] text-sm mb-6">Mulai dengan akun gratis Anda</p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-600 text-sm">{error}</p>
                {error.toLowerCase().includes("sudah terdaftar") && (
                  <Link href="/auth/login" className="text-[#0073EA] text-sm font-medium hover:underline mt-1 inline-block">
                    Ke halaman login →
                  </Link>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-[#323338] mb-1.5">Nama lengkap</label>
              <Input id="fullName" type="text" placeholder="Nama Anda" value={fullName}
                onChange={(e) => setFullName(e.target.value)} required autoComplete="name"
                className="w-full border-[#E1E5F3] rounded-xl h-11 px-4 focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#323338] mb-1.5">Email</label>
              <Input id="email" type="email" placeholder="nama@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                className="w-full border-[#E1E5F3] rounded-xl h-11 px-4 focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#323338] mb-1.5">Password</label>
              <Input id="password" type="password" placeholder="Buat password (min. 6 karakter)" value={password}
                onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password"
                className="w-full border-[#E1E5F3] rounded-xl h-11 px-4 focus:ring-2 focus:ring-[#0073EA]/20 focus:border-[#0073EA]" />
              <p className="text-xs text-[#676879] mt-1">Minimal 6 karakter</p>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-[#0073EA] to-[#0056B3] hover:from-[#0056B3] hover:to-[#0073EA] text-white rounded-xl h-11 font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-60">
              {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Membuat akun...</>) : "Buat akun"}
            </Button>
          </form>

          <p className="text-center text-sm text-[#676879] mt-6">
            Sudah punya akun?{" "}
            <Link href="/auth/login" className="text-[#0073EA] font-medium hover:underline">Masuk</Link>
          </p>

          <div className="mt-6 pt-4 border-t border-[#E1E5F3]">
            <button type="button" onClick={async () => {
              await signOut();
              window.location.reload();
            }} className="w-full text-center text-xs text-[#676879] hover:text-red-500 transition-colors py-2">
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
