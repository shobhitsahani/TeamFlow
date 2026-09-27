/** Outbound email via Resend (https://resend.com) — plain fetch, no SDK.
 *
 * Best-effort by contract: every caller treats a failed send as
 * `{ sent: false, error }` and keeps a manual relay path (copyable link +
 * code). Email must never fail invite creation — the inviter always gets the
 * link + code back to relay by hand.
 *
 * Required env (see .env.example):
 *   RESEND_API_KEY — from https://resend.com/api-keys
 *   INVITE_FROM_EMAIL — verified sender, e.g. `TeamFlow <invites@yourdomain.com>`
 *     (unverified `onboarding@resend.dev` only delivers to the account owner).
 */
import { config } from "../config.js";

export interface InviteEmail {
  to: string;
  orgName: string;
  role: string;
  invitationUrl: string;
  code: string;
  expiresAt: Date;
  inviterName?: string;
}

export interface EmailResult {
  sent: boolean;
  id?: string;
  error?: string;
}

/** True when Resend is configured and able to attempt a send. */
export function isEmailConfigured(): boolean {
  const { resendApiKey, inviteFromEmail } = config();
  return !!resendApiKey && !!inviteFromEmail;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendInviteEmail(invite: InviteEmail): Promise<EmailResult> {
  const { resendApiKey, inviteFromEmail } = config();
  if (!resendApiKey || !inviteFromEmail) {
    return { sent: false, error: "email_unconfigured" };
  }
  const subject = `You're invited to join ${invite.orgName} on TeamFlow`;
  const text =
    `Hi,\n\n` +
    `${invite.inviterName ? `${invite.inviterName} has invited` : "You've been invited"} you to join ${invite.orgName} on TeamFlow as ${invite.role}.\n\n` +
    `Join with this link (expires ${invite.expiresAt.toLocaleString()}):\n${invite.invitationUrl}\n\n` +
    `Or open ${invite.invitationUrl.split("?")[0]} and enter this code:\n${invite.code}\n\n` +
    `This invitation was sent to ${invite.to}. If you weren't expecting it, ignore this email.`;
  const html =
    `<p>Hi,</p>` +
    `<p>${escapeHtml(invite.inviterName ? `${invite.inviterName} has invited` : "You've been invited")} you to join ` +
    `<strong>${escapeHtml(invite.orgName)}</strong> on TeamFlow as <strong>${escapeHtml(invite.role)}</strong>.</p>` +
    `<p><a href="${escapeHtml(invite.invitationUrl)}">Accept the invitation</a> ` +
    `(expires ${escapeHtml(invite.expiresAt.toLocaleString())}).</p>` +
    `<p>Or enter this code on the accept page: <code style="font-size:16px;letter-spacing:2px;">${escapeHtml(invite.code)}</code></p>` +
    `<p style="color:#888;font-size:12px;">Sent to ${escapeHtml(invite.to)}. If you weren't expecting it, ignore this email.</p>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: inviteFromEmail, to: [invite.to], subject, text, html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, error: `resend_${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: data.id };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "email_failed" };
  }
}
