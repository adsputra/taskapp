"use server";

import { createClient } from "@/lib/supabase/server";
import { buildInviteEmail } from "@/lib/invite-email";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/metrics";
import { inviteRateLimiter } from "@/lib/rate-limit";
import { getRequestId } from "@/lib/request-context";
import { getSiteOrigin } from "@/lib/site-url";
import { isValidUuid } from "@/lib/validation";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_EMAIL_FROM;
  return apiKey && from ? { apiKey, from } : null;
}

/**
 * Email a pending board invitation to the invitee.
 *
 * Runs with the caller's session, so RLS decides: only an owner/admin of
 * the board can read the pending row (and its token). Without email
 * configuration it reports `sent: false` and the UI falls back to the
 * copyable link.
 *
 * @returns {Promise<{ sent: boolean, reason?: string, error?: string }>}
 */
export async function sendBoardInviteEmail(memberId) {
  const requestId = await getRequestId();

  try {
    if (!isValidUuid(memberId)) return { sent: false, error: "Undangan tidak valid." };

    const config = emailConfig();
    if (!config) return { sent: false, reason: "not_configured" };

    const origin = await getSiteOrigin();
    if (!origin) return { sent: false, reason: "not_configured" };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { sent: false, error: "Harus login untuk mengundang." };

    const limit = await inviteRateLimiter.check(`invite:${user.id}`);
    if (!limit.allowed) {
      incrementCounter("taskapp_rate_limit_blocked_total", { scope: "invite_email" });
      return { sent: false, error: "Terlalu banyak undangan. Coba lagi nanti." };
    }

    const { data: member, error } = await supabase
      .from("board_members")
      .select("id, email, role, status, token, board:boards(title)")
      .eq("id", memberId)
      .maybeSingle();

    if (error || !member || member.status !== "pending" || !member.token) {
      return { sent: false, error: "Undangan tidak ditemukan." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const message = buildInviteEmail({
      boardTitle: member.board?.title,
      inviterName: profile?.full_name || user.email,
      role: member.role,
      link: `${origin}/join?token=${encodeURIComponent(member.token)}`,
    });

    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [member.email],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      incrementCounter("taskapp_invite_email_total", { result: "provider_error" });
      logger.error("invite email rejected by provider", { requestId, status: response.status });
      return { sent: false, error: "Email gagal dikirim. Bagikan link secara manual." };
    }

    incrementCounter("taskapp_invite_email_total", { result: "sent" });
    return { sent: true };
  } catch (err) {
    incrementCounter("taskapp_invite_email_total", { result: "error" });
    logger.error("invite email failed", { requestId, detail: err?.message });
    return { sent: false, error: "Email gagal dikirim. Bagikan link secara manual." };
  }
}
