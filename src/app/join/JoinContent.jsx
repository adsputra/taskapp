"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { boardsApi } from "@/lib/api/boards";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ArrowRight, Briefcase } from "lucide-react";
import Link from "next/link";

export default function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState("loading");
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [boardId, setBoardId] = useState(null);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      const data = await boardsApi.getInvitation(token);
      if (!data) { setState("invalid"); return; }
      setInvite(data);
      if (data.status === "active") {
        setState("accepted"); setBoardId(data.board_id); return;
      }
      setState("ready");
    } catch (err) {
      setError(err.message); setState("error");
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const result = await boardsApi.acceptInvite(token);
      setBoardId(result.boardId);
      setState("accepted");
    } catch (err) {
      setError(err.message); setAccepting(false);
    }
  };

  const handleLoginAndAccept = () => {
    router.push(`/auth/login?redirect=/app/join?token=${token}`);
  };

  const goToBoard = () => {
    if (boardId) router.push(`/boards/${boardId}`);
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
          {state === "loading" && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 text-[#0073EA] animate-spin mx-auto mb-4" />
              <p className="text-[#676879]">Memuat undangan...</p>
            </div>
          )}

          {state === "invalid" && (
            <div className="text-center py-8">
              <XCircle className="w-10 h-10 text-[#E2445C] mx-auto mb-4" />
              <h2 className="text-xl font-bold text-[#323338] mb-2">Link tidak valid</h2>
              <p className="text-[#676879] mb-6">Token undangan tidak ditemukan atau sudah kadaluarsa.</p>
              <Link href="/"><Button className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg">Kembali ke Dashboard</Button></Link>
            </div>
          )}

          {state === "error" && (
            <div className="text-center py-8">
              <XCircle className="w-10 h-10 text-[#E2445C] mx-auto mb-4" />
              <h2 className="text-xl font-bold text-[#323338] mb-2">Terjadi kesalahan</h2>
              <p className="text-[#676879] mb-6">{error}</p>
              <Button onClick={loadInvitation} className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg">Coba Lagi</Button>
            </div>
          )}

          {state === "ready" && invite && (
            <>
              <h2 className="text-xl font-bold text-[#323338] mb-2">Undangan Board</h2>
              <p className="text-[#676879] mb-6">Kamu diundang untuk bergabung ke board:</p>
              <div className="bg-[#F5F6F8] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: invite.board?.color || "#0073EA" }} />
                  <div>
                    <p className="font-semibold text-[#323338]">{invite.board?.title || "Board"}</p>
                    <p className="text-xs text-[#676879]">Role: <span className="capitalize font-medium">{invite.role}</span></p>
                  </div>
                </div>
              </div>
              <Button onClick={handleAccept} disabled={accepting} className="w-full bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-12 font-medium">
                {accepting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menerima...</>) : "✅ Terima Undangan"}
              </Button>
              <p className="text-center text-xs text-[#676879] mt-4">
                Bukan akun yang tepat?{" "}
                <button onClick={handleLoginAndAccept} className="text-[#0073EA] font-medium hover:underline">Login dengan akun lain</button>
              </p>
            </>
          )}

          {state === "accepted" && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-[#00C875] mx-auto mb-4" />
              <h2 className="text-xl font-bold text-[#323338] mb-2">Berhasil Bergabung! 🎉</h2>
              <p className="text-[#676879] mb-8">Kamu sekarang memiliki akses ke board ini.</p>
              <Button onClick={goToBoard} className="w-full bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-xl h-12 font-medium">
                <ArrowRight className="w-4 h-4 mr-2" />Buka Board
              </Button>
              <div className="mt-4"><Link href="/" className="text-sm text-[#0073EA] hover:underline">Ke Dashboard dulu</Link></div>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-[#676879] mt-4">© {new Date().getFullYear()} Tuesday.com</p>
      </div>
    </div>
  );
}
