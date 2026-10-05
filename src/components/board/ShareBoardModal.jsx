"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { boardsApi } from "@/lib/api/boards";
import { sendBoardInviteEmail } from "@/app/actions/invites";
import { toast } from "sonner";
import {
  Copy,
  Link,
  Mail,
  X,
  Users,
  UserPlus,
  ChevronDown,
  Shield,
} from "lucide-react";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", desc: "Can manage board" },
  { value: "editor", label: "Editor", desc: "Can edit content" },
  { value: "viewer", label: "Viewer", desc: "Can view only" },
];

const ROLE_ORDER = { admin: 0, editor: 1, viewer: 2 };

const ROLE_BADGE_CLASS = {
  admin: "bg-primary/10 text-primary border-primary/20",
  editor: "bg-success/10 text-success border-success/20",
  viewer: "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20",
};

export default function ShareBoardModal({ isOpen, onClose, board }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [isLoading, setIsLoading] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [editingMemberId, setEditingMemberId] = useState(null);

  const queryClient = useQueryClient();
  const membersKey = ["board-members", board?.id];

  // Shared with PeopleCell; RealtimeSync refreshes it on board_members changes.
  const { data: members = [] } = useQuery({
    queryKey: membersKey,
    queryFn: () => boardsApi.listMembers(board.id),
    enabled: isOpen && !!board?.id,
  });

  const loadMembers = () => queryClient.invalidateQueries({ queryKey: membersKey });
  const setMembers = (update) => queryClient.setQueryData(membersKey, (prev = []) => update(prev));

  const handleShare = async () => {
    const invitee = email.trim();
    if (!invitee || !invitee.includes("@")) return;
    setIsLoading(true);
    try {
      const result = await boardsApi.share(board.id, { email: invitee, role });
      setShareLink(result.shareLink);
      setEmail("");
      await loadMembers();
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["board", board?.id] });

      // Email is optional (RESEND_API_KEY); the link below always works.
      const delivery = await sendBoardInviteEmail(result.id).catch(() => ({ sent: false }));
      if (delivery.sent) {
        toast.success(`Invitation emailed to ${invitee}`);
      } else if (delivery.error) {
        toast.warning(delivery.error);
      } else {
        toast.success(`Invite created — copy the link below and send it to ${invitee}`);
      }
    } catch (err) {
      toast.error(err.message);
    }
    setIsLoading(false);
  };

  const handleUnshare = async (memberId) => {
    try {
      await boardsApi.unshare(board.id, memberId);
      await loadMembers();
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["board", board?.id] });
      toast.success("Access removed");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRoleChange = async (member, newRole) => {
    // Owner protection: tidak bisa ubah role owner
    const isOwner = member.user_id === board.user_id;
    if (isOwner) {
      toast.error("Cannot change the board owner's role.");
      return;
    }

    // Konfirmasi saat downgrade
    const currentOrder = ROLE_ORDER[member.role] ?? 0;
    const newOrder = ROLE_ORDER[newRole] ?? 0;
    if (newOrder > currentOrder) {
      const confirmed = window.confirm(
        `Are you sure you want to change ${member.email}'s role from ${member.role} to ${newRole}? They will lose some permissions.`
      );
      if (!confirmed) return;
    }

    // Optimistic update
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
    );

    try {
      await boardsApi.updateMemberRole(board.id, member.id, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
    } catch (err) {
      // Rollback
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, role: member.role } : m
        )
      );
      toast.error(err.message);
    } finally {
      setEditingMemberId(null);
    }
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard!");
  };

  const resendInvite = async (member) => {
    const delivery = await sendBoardInviteEmail(member.id).catch(() => ({ sent: false }));
    if (delivery.sent) toast.success(`Invitation emailed to ${member.email}`);
    else toast.warning(delivery.error || "Email is not configured — copy the link instead.");
  };

  const statusLabel = (s) =>
    s === "active" ? "Active" : s === "pending" ? "Pending" : s;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" />
            Share &ldquo;{board?.title}&rdquo;
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-3">
          {/* Invite Form */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Invite people via email
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  aria-label="Email address to invite"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleShare()}
                  placeholder="colleague@email.com"
                  className="rounded-lg border-border h-10 focus:ring-primary"
                />
              </div>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger aria-label="Role" className="w-[110px] h-10 rounded-lg border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleShare}
                disabled={
                  !email.trim() || isLoading || !email.includes("@")
                }
                className="bg-primary hover:bg-primary/90 text-white rounded-lg h-10 px-4"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Invite
              </Button>
            </div>
          </div>

          {/* Share Link (muncul setelah invite) */}
          {shareLink && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-xs font-medium text-foreground mb-2">
                Share this link with your colleague:
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareLink}
                  aria-label="Invite link"
                  className="text-xs bg-card rounded border-primary/30 h-8"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyLink(shareLink)}
                  aria-label="Copy invite link"
                  className="h-8 px-2 border-primary text-primary"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Member List */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
              <Users className="w-4 h-4" />
              People with access ({members.length})
            </h4>
            {members.length === 0 ? (
              <p className="text-xs text-subtle-foreground py-2">
                No members yet. Invite someone above.
              </p>
            ) : (
              <div className="space-y-1 max-h-[220px] overflow-y-auto">
                {members.map((member) => {
                  const isOwner = member.user_id === board?.user_id;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                          {isOwner ? (
                            <Shield className="w-4 h-4 text-primary" />
                          ) : (
                            <Mail className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate">
                            {member.email}
                          </p>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] ${
                                member.status === "active"
                                  ? "text-success"
                                  : "text-warning"
                              }`}
                            >
                              {statusLabel(member.status)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Role Badge / Dropdown */}
                        {isOwner ? (
                          <Badge className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 cursor-default">
                            <Shield className="w-3 h-3 mr-1" />
                            Owner
                          </Badge>
                        ) : (
                          <Select
                            value={member.role}
                            onValueChange={(newRole) =>
                              handleRoleChange(member, newRole)
                            }
                          >
                            <SelectTrigger
                              className={`h-6 text-[10px] px-2 py-0 gap-1 border rounded-full min-w-[80px] w-auto ${ROLE_BADGE_CLASS[member.role] || ROLE_BADGE_CLASS.editor}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Action buttons */}
                        {member.status === "pending" && member.token && (
                          <>
                            <button
                              type="button"
                              onClick={() => resendInvite(member)}
                              className="p-1.5 text-subtle-foreground hover:text-primary transition-colors"
                              title="Email the invitation again"
                              aria-label={`Email the invitation to ${member.email} again`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                copyLink(
                                  `${window.location.origin}/join?token=${encodeURIComponent(member.token)}`
                                )
                              }
                              className="p-1.5 text-subtle-foreground hover:text-primary transition-colors"
                              title="Copy invite link"
                              aria-label={`Copy invite link for ${member.email}`}
                            >
                              <Link className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {/* Hanya bisa unshare non-owner */}
                        {!isOwner && (
                          <button
                            type="button"
                            onClick={() => handleUnshare(member.id)}
                            className="p-1.5 text-subtle-foreground hover:text-destructive transition-colors"
                            title="Remove access"
                            aria-label={`Remove ${member.email}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
