"use client";

import React, { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { Copy, Link, Mail, X, Users, UserPlus } from "lucide-react";

export default function ShareBoardModal({ isOpen, onClose, board }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shareLink, setShareLink] = useState("");

  useEffect(() => {
    if (isOpen && board?.id) {
      loadMembers();
    }
  }, [isOpen, board?.id]);

  const loadMembers = async () => {
    try {
      const data = await boardsApi.listMembers(board.id);
      setMembers(data || []);
    } catch (err) {
      console.error("Failed to load members:", err);
    }
  };

  const handleShare = async () => {
    if (!email.trim() || !email.includes("@")) return;
    setIsLoading(true);
    try {
      const result = await boardsApi.share(board.id, { email: email.trim(), role });
      setShareLink(result.shareLink);
      setEmail("");
      await loadMembers();
      toast.success(`Invite sent to ${email}`);
    } catch (err) {
      toast.error(err.message);
    }
    setIsLoading(false);
  };

  const handleUnshare = async (memberId) => {
    try {
      await boardsApi.unshare(board.id, memberId);
      await loadMembers();
      toast.success("Access removed");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard!");
  };

  const roleOptions = [
    { value: "editor", label: "Editor", desc: "Can edit content" },
    { value: "viewer", label: "Viewer", desc: "Can view only" },
    { value: "admin", label: "Admin", desc: "Can manage board" },
  ];

  const statusLabel = (s) =>
    s === "active" ? "Active" : s === "pending" ? "Pending" : s;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#323338] flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-[#0073EA]" />
            Share "{board?.title}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-3">
          {/* Invite Form */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#323338]">
              Invite people via email
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleShare()}
                  placeholder="colleague@email.com"
                  className="rounded-lg border-[#E1E5F3] h-10 focus:ring-[#0073EA]"
                />
              </div>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-[110px] h-10 rounded-lg border-[#E1E5F3]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleShare}
                disabled={!email.trim() || isLoading || !email.includes("@")}
                className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg h-10 px-4"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Invite
              </Button>
            </div>
          </div>

          {/* Share Link (muncul setelah invite) */}
          {shareLink && (
            <div className="p-3 bg-[#E8F4FD] rounded-lg border border-[#0073EA]/20">
              <p className="text-xs font-medium text-[#323338] mb-2">
                Share this link with your colleague:
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareLink}
                  className="text-xs bg-white rounded border-[#0073EA]/30 h-8"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyLink(shareLink)}
                  className="h-8 px-2 border-[#0073EA] text-[#0073EA]"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Member List */}
          <div>
            <h4 className="text-sm font-medium text-[#323338] mb-2 flex items-center gap-1">
              <Users className="w-4 h-4" />
              People with access ({members.length})
            </h4>
            {members.length === 0 ? (
              <p className="text-xs text-[#A0A0A0] py-2">
                No members yet. Invite someone above.
              </p>
            ) : (
              <div className="space-y-1 max-h-[180px] overflow-y-auto">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#F5F6F8]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-[#0073EA]/10 rounded-full flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4 text-[#0073EA]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-[#323338] truncate">
                          {member.email}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`text-[10px] px-1.5 py-0 ${
                              member.role === "admin"
                                ? "bg-[#0073EA]/10 text-[#0073EA]"
                                : member.role === "editor"
                                ? "bg-[#00C875]/10 text-[#00C875]"
                                : "bg-[#676879]/10 text-[#676879]"
                            }`}
                          >
                            {member.role}
                          </Badge>
                          <span
                            className={`text-[10px] ${
                              member.status === "active"
                                ? "text-[#00C875]"
                                : "text-[#FF9900]"
                            }`}
                          >
                            {statusLabel(member.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {member.status === "pending" && member.token && (
                        <button
                          onClick={() =>
                            copyLink(
                              `${window.location.origin}/app/join?token=${member.token}`
                            )
                          }
                          className="p-1.5 text-[#A0A0A0] hover:text-[#0073EA] transition-colors"
                          title="Copy invite link"
                        >
                          <Link className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleUnshare(member.id)}
                        className="p-1.5 text-[#A0A0A0] hover:text-red-500 transition-colors"
                        title="Remove access"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
