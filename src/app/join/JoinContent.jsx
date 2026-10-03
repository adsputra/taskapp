"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { boardsApi } from "@/lib/api/boards";
import { teamApi } from "@/lib/api/team";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ArrowRight, Briefcase, Users, Shield } from "lucide-react";
import Link from "next/link";

export default function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const boardToken = searchParams.get("token");
  const teamToken = searchParams.get("team") || searchParams.get("team_token");
  const isTeam = Boolean(teamToken);
  const token = teamToken || boardToken;

  const [state, setState] = useState("loading");
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [boardId, setBoardId] = useState(null);

  const loadInvitation = useCallback(async () => {
    try {
      if (isTeam) {
        const data = await teamApi.getInvitation(token);
        if (!data) { setState("invalid"); return; }
        setInvite(data);
        if (data.status === "active") {
          setState("accepted");
          return;
        }
        setState("ready");
      } else {
        const data = await boardsApi.getInvitation(token);
        if (!data) { setState("invalid"); return; }
        setInvite(data);
        if (data.status === "active") {
          setState("accepted");
          setBoardId(data.board_id);
          return;
        }
        setState("ready");
      }
    } catch (err) {
      setError(err.message);
      setState("error");
    }
  }, [isTeam, token]);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    loadInvitation();
  }, [token, loadInvitation]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      if (isTeam) {
        await teamApi.acceptInvite(token);
        setState("accepted");
      } else {
        const result = await boardsApi.acceptInvite(token);
        setBoardId(result.boardId);
        setState("accepted");
      }
    } catch (err) {
      setError(err.message);
      setAccepting(false);
    }
  };

  const handleLoginAndAccept = async () => {
    await signOut();
    const redirectUrl = isTeam ? `/join?team=${token}` : `/join?token=${token}`;
    router.push(`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`);
  };

  const handleFinish = () => {
    if (isTeam || !boardId) {
      router.push("/boards");
    } else {
      router.push(`/boards/${boardId}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] rounded-xl flex items-center justify-center shadow-md">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-[#323338] dark:text-slate-100 text-2xl">Tuesday</span>
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-[#E1E5F3] dark:border-slate-800 p-8">
          {state === "loading" && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 text-[#0073EA] animate-spin mx-auto mb-4" />
              <p className="text-[#676879] dark:text-slate-400">Memuat undangan...</p>
            </div>
          )}

          {state === "invalid" && (
            <div className="text-center py-8">
              <XCircle className="w-10 h-10 text-[#E2445C] mx-auto mb-4" />
              <h2 className="text-xl font-bold text-[#323338] dark:text-slate-100 mb-2">Link tidak valid</h2>
              <p className="text-[#676879] dark:text-slate-400 mb-6">Token undangan tidak ditemukan atau sudah kadaluarsa.</p>
              <Link href="/">
                <Button className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg">
                  Kembali ke Dashboard
                </Button>
              </Link>
            </div>
          )}

          {state === "error" && (
            <div className="text-center py-8">
              <XCircle className="w-10 h-10 text-[#E2445C] mx-auto mb-4" />
              <h2 className="text-xl font-bold text-[#323338] dark:text-slate-100 mb-2">Terjadi kesalahan</h2>
              <p className="text-[#676879] dark:text-slate-400 mb-6">{error}</p>
              <Button onClick={loadInvitation} className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg">
                Coba Lagi
              </Button>
            </div>
          )}

          {state === "ready" && invite && (
            <>
              <h2 className="text-xl font-bold text-[#323338] dark:text-slate-100 mb-2">
                {isTeam ? "Undangan Bergabung Tim" : "Undangan Board"}
              </h2>
              <p className="text-[#676879] dark:text-slate-400 mb-6 text-sm">
                {isTeam
                  ? "Kamu diundang untuk bergabung ke tim kerja:"
                  : "Kamu diundang untuk bergabung ke board:"}
              </p>

              <div className="bg-[#F5F6F8] dark:bg-slate-800/80 rounded-xl p-4 mb-6 border border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  {isTeam ? (
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                  ) : (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: invite.board?.color || "#0073EA" }}
                    />
                  )}
                  <div>
                    <p className="font-semibold text-[#323338] dark:text-slate-100">
                      {isTeam
                        ? `Tim ${invite.owner?.fullName || "Workspace"}`
                        : (invite.board?.title || "Board")}
                    </p>
                    <p className="text-xs text-[#676879] dark:text-slate-400">
                      Role: <span className="capitalize font-medium text-slate-800 dark:text-slate-200">{invite.role}</span>
                      {isTeam && invite.owner?.email && (
                        <span className="block text-[11px] text-slate-400">Owner: {invite.owner.email}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-12 font-medium"
              >
                {accepting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Menerima...
                  </>
                ) : (
                  "✅ Terima Undangan"
                )}
              </Button>

              {error && <p className="text-sm text-[#E2445C] mt-3 text-center">{error}</p>}

              <p className="text-center text-xs text-[#676879] dark:text-slate-400 mt-4">
                Bukan akun yang tepat?{" "}
                <button
                  type="button"
                  onClick={handleLoginAndAccept}
                  className="text-[#0073EA] font-medium hover:underline"
                >
                  Login dengan akun lain
                </button>
              </p>
            </>
          )}

          {state === "accepted" && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-[#00C875] mx-auto mb-4" />
              <h2 className="text-xl font-bold text-[#323338] dark:text-slate-100 mb-2">
                Berhasil Bergabung! 🎉
              </h2>
              <p className="text-[#676879] dark:text-slate-400 mb-8 text-sm">
                {isTeam
                  ? "Kamu sekarang resmi menjadi anggota tim dan dapat mengakses semua board bersama (Shared)."
                  : "Kamu sekarang memiliki akses ke board ini."}
              </p>
              <Button
                onClick={handleFinish}
                className="w-full bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-12 font-medium"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {isTeam ? "Buka Daftar Boards" : "Buka Board"}
              </Button>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-[#676879] dark:text-slate-500 mt-4">
          © {new Date().getFullYear()} Tuesday
        </p>
      </div>
    </div>
  );
}
