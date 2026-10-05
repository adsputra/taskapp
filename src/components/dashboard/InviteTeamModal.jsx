"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Mail, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { boardsApi } from "@/lib/api/boards";
import { userApi } from "@/lib/api/user";
import { sendBoardInviteEmail } from "@/app/actions/invites";
import { isValidEmail } from "@/lib/validation";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", description: "Manage the board, its members and automations" },
  { value: "editor", label: "Editor", description: "Create and edit tasks" },
  { value: "viewer", label: "Viewer", description: "View only" },
];

/**
 * Invite several people to one of your boards at once. Each invitation is
 * a real board_members row; the email is sent when RESEND_API_KEY is set,
 * otherwise the links are listed for copying.
 */
export default function InviteTeamModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [emails, setEmails] = useState([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [boardId, setBoardId] = useState("");
  const [sending, setSending] = useState(false);
  const [links, setLinks] = useState([]); // [{ email, link }] when not emailed

  const { data: me } = useQuery({ queryKey: ["user"], queryFn: () => userApi.me(), staleTime: 5 * 60 * 1000 });
  const { data: boards = [] } = useQuery({
    queryKey: ["boards"],
    queryFn: () => boardsApi.list(),
    enabled: isOpen,
  });
  // Owners can invite; admin rights on other boards are checked by the database.
  const ownBoards = boards.filter((board) => board.user_id === me?.id);
  const selectedBoardId = boardId || ownBoards[0]?.id || "";

  const addEmail = () => {
    const email = currentEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      if (email) toast.error("Email tidak valid.");
      return;
    }
    if (!emails.includes(email)) setEmails([...emails, email]);
    setCurrentEmail("");
  };

  const reset = () => {
    setEmails([]);
    setCurrentEmail("");
    setRole("editor");
    setLinks([]);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleSend = async () => {
    const pending = currentEmail.trim() ? [...emails, currentEmail.trim().toLowerCase()] : emails;
    const recipients = [...new Set(pending)].filter(isValidEmail);
    if (recipients.length === 0 || !selectedBoardId) return;

    setSending(true);
    const notEmailed = [];
    let created = 0;
    for (const email of recipients) {
      try {
        const invite = await boardsApi.share(selectedBoardId, { email, role });
        created++;
        const delivery = await sendBoardInviteEmail(invite.id).catch(() => ({ sent: false }));
        if (!delivery.sent) notEmailed.push({ email, link: invite.shareLink });
      } catch (err) {
        toast.error(`${email}: ${err.message}`);
      }
    }
    setSending(false);
    queryClient.invalidateQueries({ queryKey: ["boards"] });
    queryClient.invalidateQueries({ queryKey: ["board-members", selectedBoardId] });

    if (created === 0) return;
    const emailed = created - notEmailed.length;
    toast.success(
      emailed > 0
        ? `${created} invitation${created > 1 ? "s" : ""} created, ${emailed} emailed`
        : `${created} invitation${created > 1 ? "s" : ""} created`
    );
    setEmails([]);
    setCurrentEmail("");
    if (notEmailed.length > 0) setLinks(notEmailed);
    else close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <UserPlus className="h-6 w-6 text-primary" />
            Invite people
          </DialogTitle>
          <DialogDescription>Invitations are tied to the email address and expire after 14 days.</DialogDescription>
        </DialogHeader>

        {links.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Email delivery is not configured, so send these links yourself:
            </p>
            <ul className="space-y-2">
              {links.map(({ email, link }) => (
                <li key={email} className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{email}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(link);
                      toast.success(`Link for ${email} copied`);
                    }}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button onClick={close}>
                <Check className="mr-1.5 h-4 w-4" /> Done
              </Button>
            </div>
          </div>
        ) : ownBoards.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Create a board first — people are invited to a board.</p>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="invite-board">Board</Label>
              <Select value={selectedBoardId} onValueChange={setBoardId}>
                <SelectTrigger id="invite-board">
                  <SelectValue placeholder="Choose a board" />
                </SelectTrigger>
                <SelectContent>
                  {ownBoards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: board.color }} />
                        {board.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-email">Email addresses</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={currentEmail}
                  onChange={(e) => setCurrentEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addEmail} aria-label="Add email">
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
              {emails.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {emails.map((email) => (
                    <li
                      key={email}
                      className="flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-sm text-primary"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => setEmails(emails.filter((e) => e !== email))}
                        aria-label={`Remove ${email}`}
                        className="rounded-full p-0.5 hover:bg-primary/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="font-medium">{option.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{option.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={close} disabled={sending}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || (emails.length === 0 && !isValidEmail(currentEmail.trim()))}
              >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Send invitations
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
