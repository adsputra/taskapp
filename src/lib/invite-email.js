/**
 * Board invitation email (pure). Every user-controlled value — board
 * title, inviter name — is HTML-escaped; the link is built by the server.
 */

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ROLE_LABELS = { admin: "Admin", editor: "Editor", viewer: "Viewer" };

export function buildInviteEmail({ boardTitle, inviterName, role, link }) {
  const board = String(boardTitle || "a board").slice(0, 200);
  const inviter = String(inviterName || "A teammate").slice(0, 100);
  const roleLabel = ROLE_LABELS[role] || "Member";

  const subject = `${inviter} invited you to "${board}"`.replace(/[\r\n]+/g, " ");
  const text = [
    `${inviter} invited you to join "${board}" as ${roleLabel}.`,
    "",
    `Accept the invitation: ${link}`,
    "",
    "The link expires in 14 days and only works for this email address.",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
    <tr><td style="padding:28px">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">Tuesday</p>
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">You're invited to ${escapeHtml(board)}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5">
        ${escapeHtml(inviter)} invited you to collaborate as <strong>${escapeHtml(roleLabel)}</strong>.
      </p>
      <a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600">Accept invitation</a>
      <p style="margin:24px 0 0;font-size:12px;color:#64748b">This link expires in 14 days and only works for this email address.</p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}
