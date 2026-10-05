"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { boardsApi } from "@/lib/api/boards";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ArrowRight, Briefcase, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [acceptedBoardId, setAcceptedBoardId] = useState(null);

  const {
    data: invite,
    error: loadError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => boardsApi.getInvitation(token),
    enabled: Boolean(token),
    retry: false,
  });

  const boardId = acceptedBoardId || (invite?.status === "active" ? invite.board_id : null);
  const state = !token
    ? "invalid"
    : isLoading
      ? "loading"
      : loadError
        ? "error"
        : !invite
          ? "invalid"
          : boardId
            ? "accepted"
            : "ready";

  const handleAccept = async () => {
    setAccepting(true);
    setError("");
    try {
      const result = await boardsApi.acceptInvite(token);
      setAcceptedBoardId(result.boardId);
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  const handleLoginAndAccept = async () => {
    await signOut();
    router.push(`/auth/login?redirect=${encodeURIComponent(`/join?token=${token}`)}`);
  };

  const goToBoard = () => {
    if (boardId) router.push(`/boards/${boardId}`);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-foreground text-2xl">Tuesday</span>
          </Link>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {state === "loading" && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Memuat undangan...</p>
            </div>
          )}

          {state === "invalid" && (
            <div className="text-center py-8">
              <XCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Link tidak valid</h2>
              <p className="text-muted-foreground mb-6">Token undangan tidak ditemukan atau sudah kadaluarsa.</p>
              <Link href="/">
                <Button className="bg-primary hover:bg-primary/90 text-white rounded-lg">
                  Kembali ke Dashboard
                </Button>
              </Link>
            </div>
          )}

          {state === "error" && (
            <div className="text-center py-8">
              <XCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Terjadi kesalahan</h2>
              <p className="text-muted-foreground mb-6">{loadError?.message}</p>
              <Button onClick={() => refetch()} className="bg-primary hover:bg-primary/90 text-white rounded-lg">
                Coba Lagi
              </Button>
            </div>
          )}

          {state === "ready" && invite && (
            <>
              <h2 className="text-xl font-bold text-foreground mb-2">Undangan Board</h2>
              <p className="text-muted-foreground mb-6 text-sm">Kamu diundang untuk bergabung ke board:</p>
              <div className="bg-muted rounded-xl p-4 mb-6 border border-border">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: invite.board?.color || "#2563EB" }}
                  />
                  <div>
                    <p className="font-semibold text-foreground">{invite.board?.title || "Board"}</p>
                    <p className="text-xs text-muted-foreground">
                      Role: <span className="capitalize font-medium text-foreground">{invite.role}</span>
                    </p>
                  </div>
                </div>
              </div>
              {invite.email_matches === false && (
                <div className="mb-4 flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p>Undangan ini untuk alamat email lain. Login dengan akun yang diundang untuk menerimanya.</p>
                </div>
              )}
              <Button
                onClick={handleAccept}
                disabled={accepting || invite.email_matches === false}
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-12 font-medium"
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

              {error && <p className="text-sm text-destructive mt-3 text-center">{error}</p>}
              <p className="text-center text-xs text-muted-foreground mt-4">
                Bukan akun yang tepat?{" "}
                <button
                  type="button"
                  onClick={handleLoginAndAccept}
                  className="text-primary font-medium hover:underline"
                >
                  Login dengan akun lain
                </button>
              </p>
            </>
          )}

          {state === "accepted" && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Berhasil Bergabung! 🎉</h2>
              <p className="text-muted-foreground mb-8 text-sm">Kamu sekarang memiliki akses ke board ini.</p>
              <Button
                onClick={goToBoard}
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-12 font-medium"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Buka Board
              </Button>
              <div className="mt-4">
                <Link href="/" className="text-sm text-primary hover:underline">
                  Ke Dashboard dulu
                </Link>
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          © {new Date().getFullYear()} Tuesday
        </p>
      </div>
    </div>
  );
}
