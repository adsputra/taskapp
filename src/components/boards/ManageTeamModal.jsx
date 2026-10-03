"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { teamApi } from "@/lib/api/team";
import { toast } from "sonner";
import {
  Copy,
  Link as LinkIcon,
  Mail,
  X,
  Users,
  UserPlus,
  Shield,
  Check,
} from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

const TEAM_ROLE_OPTIONS = [
  { value: "admin", label: "Admin", desc: "Can manage team & create shared boards" },
  { value: "member", label: "Member", desc: "Can view & edit team shared boards" },
];

const ROLE_BADGE_CLASS = {
  admin: "bg-[#0073EA]/10 text-[#0073EA] border-[#0073EA]/20",
  member: "bg-[#00C875]/10 text-[#00C875] border-[#00C875]/20",
};

export default function ManageTeamModal({ isOpen, onClose, onTeamUpdated }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: teamData = { owner: null, members: [] }, isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => teamApi.listMembers(),
    enabled: isOpen,
    staleTime: 10 * 1000,
  });

  const refreshTeam = () => {
    queryClient.invalidateQueries({ queryKey: ["team-members"] });
    if (onTeamUpdated) onTeamUpdated();
  };

  useEffect(() => {
    if (isOpen) {
      setShareLink("");
    }
  }, [isOpen]);

  const handleInvite = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Masukkan alamat email yang valid.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await teamApi.invite({ email: cleanEmail, role });
      setShareLink(result.shareLink);
      setEmail("");
      refreshTeam();
      toast.success(`Undangan berhasil dikirim ke ${cleanEmail}`);
    } catch (err) {
      toast.error(err.message || "Gagal mengundang anggota tim.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId, memberEmail) => {
    if (!window.confirm(`Hapus ${memberEmail} dari tim? Akses ke semua board tim akan dicabut.`)) {
      return;
    }

    try {
      await teamApi.removeMember(memberId);
      refreshTeam();
      toast.success("Anggota berhasil dihapus dari tim.");
    } catch (err) {
      toast.error(err.message || "Gagal menghapus anggota.");
    }
  };

  const handleRoleChange = async (member, newRole) => {
    if (member.role === newRole) return;

    try {
      await teamApi.updateRole(member.id, newRole);
      refreshTeam();
      toast.success(`Role diperbarui menjadi ${newRole}.`);
    } catch (err) {
      toast.error(err.message || "Gagal mengubah role anggota.");
      refreshTeam();
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Link undangan berhasil disalin!");
    setTimeout(() => setCopied(false), 2000);
  };

  const isCurrentOwner = teamData.owner?.isCurrent ?? true;
  const totalCount = (teamData.owner ? 1 : 0) + (teamData.members?.length || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
            <Users className="w-5 h-5 text-[#0073EA]" />
            Manage Team
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kelola anggota yang memiliki akses ke workspace dan board bersama (Shared).
          </p>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Invite Form */}
          {isCurrentOwner && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Invite people to your team via email
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                    placeholder="colleague@email.com"
                    className="rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 h-10 focus:ring-[#0073EA] text-sm"
                  />
                </div>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="w-[110px] h-10 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleInvite}
                  disabled={!email.trim() || isSubmitting || !email.includes("@")}
                  className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg h-10 px-4 text-xs font-medium shrink-0"
                >
                  <UserPlus className="w-4 h-4 mr-1.5" />
                  Invite
                </Button>
              </div>
            </div>
          )}

          {/* Share Link Banner (after invite or on demand) */}
          {shareLink && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/50">
              <p className="text-xs font-medium text-blue-900 dark:text-blue-300 mb-2">
                Bagikan link ini ke rekan kerja Anda (WhatsApp / Email):
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareLink}
                  className="text-xs bg-white dark:bg-slate-900 rounded-lg border-blue-200 dark:border-blue-800 h-8"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(shareLink)}
                  className="h-8 px-3 border-[#0073EA] text-[#0073EA] hover:bg-blue-50 dark:hover:bg-blue-950 shrink-0 text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          )}

          {/* Members List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-500" />
                Team members ({totalCount})
              </h4>
            </div>

            {isLoading ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Memuat anggota tim...
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                {/* 1. Team Owner Item */}
                {teamData.owner && (
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                        {teamData.owner.fullName?.[0]?.toUpperCase() || teamData.owner.email?.[0]?.toUpperCase() || "O"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                            {teamData.owner.fullName || "Team Owner"}
                          </p>
                          {teamData.owner.isCurrent && (
                            <span className="text-[10px] text-slate-400 font-normal">(You)</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {teamData.owner.email}
                        </p>
                      </div>
                    </div>
                    <Badge className="text-[10px] px-2 py-0.5 bg-[#0073EA]/10 text-[#0073EA] border border-[#0073EA]/20 font-medium">
                      <Shield className="w-3 h-3 mr-1" />
                      Owner
                    </Badge>
                  </div>
                )}

                {/* 2. Team Members List */}
                {teamData.members?.map((member) => {
                  const initial = (member.profile?.fullName || member.email || "M")[0].toUpperCase();
                  const displayName = member.profile?.fullName || member.email;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-semibold shrink-0">
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                            {displayName}
                          </p>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-medium ${
                                member.status === "active"
                                  ? "text-[#00C875]"
                                  : "text-[#FF9900]"
                              }`}
                            >
                              {member.status === "active" ? "Active" : "Pending Invite"}
                            </span>
                            {member.profile?.fullName && (
                              <span className="text-[10px] text-slate-400 truncate">
                                {member.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Role Select */}
                        {isCurrentOwner ? (
                          <Select
                            value={member.role}
                            onValueChange={(newRole) => handleRoleChange(member, newRole)}
                          >
                            <SelectTrigger
                              className={`h-6 text-[10px] px-2 py-0 gap-1 border rounded-full min-w-[75px] w-auto font-medium ${
                                ROLE_BADGE_CLASS[member.role] || ROLE_BADGE_CLASS.member
                              }`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TEAM_ROLE_OPTIONS.map((r) => (
                                <SelectItem key={r.value} value={r.value} className="text-xs">
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              ROLE_BADGE_CLASS[member.role] || ROLE_BADGE_CLASS.member
                            }`}
                          >
                            {member.role === "admin" ? "Admin" : "Member"}
                          </Badge>
                        )}

                        {/* Copy invite link for pending members */}
                        {member.status === "pending" && member.token && (
                          <button
                            onClick={() =>
                              copyToClipboard(`${window.location.origin}/join?team=${member.token}`)
                            }
                            className="p-1.5 text-slate-400 hover:text-[#0073EA] transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Copy invite link"
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Remove Member button */}
                        {isCurrentOwner && (
                          <button
                            onClick={() => handleRemoveMember(member.id, member.email)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Remove member"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {(!teamData.members || teamData.members.length === 0) && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Belum ada anggota lain di tim. Undang rekan kerja Anda menggunakan form di atas.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
