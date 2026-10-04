/** Outbound email via Supabase Auth (mailer-only — no Resend).
 *
 * Best-effort by contract: every caller treats a failed send as
 * `{ sent: false, error }` and keeps a manual relay path (copyable link +
 * code). Email must never fail invite creation — the inviter always gets the
 * link + code back to relay by hand.
 *
 * How it works: the backend calls the linked Supabase project's Auth API, so
 * delivery uses Supabase's built-in mailer — no separate mail provider or
 * verified sender domain is needed for basic delivery. TeamFlow passwords and
 * sessions stay custom (Postgres + JWT); Supabase is only the envelope.
 * Side effect: inviting an address creates a row in `auth.users` on the
 * Supabase project (harmless, and useful if auth ever migrates fully).
 *
 * Required env (see .env.example):
 *   SUPABASE_URL — e.g. `https://<ref>.supabase.co`
 *   SUPABASE_SERVICE_ROLE_KEY — Dashboard → Project Settings → API keys
 *     (service_role, SECRET — never commit, never expose to the browser).
 *   SUPABASE_ANON_KEY — same page (optional; OTP sends fall back to the
 *     service key when unset).
 *
 * Required Supabase dashboard setup (Auth → Email Templates + URL Config):
 *   1. Invite template must render the TeamFlow fields carried in
 *      `user_metadata`:
 *        Join link: {{ .Data.invitation_url }}
 *        Code:      {{ .Data.invite_code }}
 *      (also {{ .Data.org_name }}, {{ .Data.role }}, {{ .Data.inviter_name }}).
 *   2. Magic Link template must render the same invite fields (existing-user
 *      fallback path) plus the workspace-deletion code:
 *        {{ .Data.delete_code }} (with {{ .Data.org_name }}).
 *   3. URL Configuration: Site URL + Redirect URLs must allowlist the
 *      frontend origin(s), e.g. your `*.vercel.app` URL and
 *      `http://localhost:4000` — otherwise `redirect_to` is ignored.
 *
 * Ops gotcha: keys present but wrong/unreachable is NOT a silent success —
 * callers get `{ sent: false, error: "supabase_<status>: …" }`, and a project
 * over its email rate limit surfaces the same way. Both reach the client so a
 * misconfigured mailer is diagnosable instead of looking like a missing code.
 * For production volume, configure custom SMTP in the Supabase dashboard.
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

/** True when Supabase Auth is configured and able to attempt a send. */
export function isEmailConfigured(): boolean {
  const { supabaseUrl, supabaseServiceRoleKey } = config();
  return !!supabaseUrl && !!supabaseServiceRoleKey;
}

interface Mailer {
  base: string;
  serviceKey: string;
  anonKey: string;
}

function mailer(): Mailer | null {
  const { supabaseUrl, supabaseServiceRoleKey, supabaseAnonKey } = config();
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return {
    base: supabaseAuthBase(supabaseUrl),
    serviceKey: supabaseServiceRoleKey,
    anonKey: supabaseAnonKey ?? supabaseServiceRoleKey,
  };
}

/** Auth API root for a configured SUPABASE_URL.
 *
 * SUPABASE_URL must be the project root (`https://<ref>.supabase.co`) — the
 * mailer appends `/auth/v1` itself. A common misconfig copies a URL that
 * already ends in `/auth/v1` (API docs show the full path), which doubles it
 * to `/auth/v1/auth/v1/admin/invite`; GoTrue then answers plain-text
 * `404 page not found`. Normalize the suffix so sends survive it (config.ts
 * also logs a warning telling ops to fix the env var). */
export function supabaseAuthBase(supabaseUrl: string): string {
  const root = supabaseUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/auth\/v1$/i, "");
  return `${root}/auth/v1`;
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  // 404 from GoTrue is almost always a wrong SUPABASE_URL (see above) — say
  // so inline, otherwise ops chase a "missing page" that is really config.
  const hint =
    res.status === 404
      ? " (likely wrong SUPABASE_URL: must be https://<ref>.supabase.co with no /auth/v1 suffix, key from the same project)"
      : "";
  return `supabase_${res.status}: ${body.slice(0, 200)}${hint}`;
}

export async function sendInviteEmail(invite: InviteEmail): Promise<EmailResult> {
  const m = mailer();
  if (!m) {
    return { sent: false, error: "email_unconfigured" };
  }
  const data = {
    org_name: invite.orgName,
    role: invite.role,
    invitation_url: invite.invitationUrl,
    invite_code: invite.code,
    expires_at: invite.expiresAt.toISOString(),
    ...(invite.inviterName ? { inviter_name: invite.inviterName } : {}),
  };
  const redirect = `?redirect_to=${encodeURIComponent(invite.invitationUrl)}`;

  try {
    // 1) Supabase invite — sends the project's Invite email template and
    // creates an auth user when the address is new.
    const res = await fetch(`${m.base}/admin/invite${redirect}`, {
      method: "POST",
      headers: { apikey: m.serviceKey, Authorization: `Bearer ${m.serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: invite.to, data }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { id?: string };
      return { sent: true, id: body.id };
    }
    if (res.status !== 422) {
      return { sent: false, error: await readError(res) };
    }
    // 2) 422 = address already registered in Supabase Auth (common on
    // re-invites and for existing TeamFlow members). Fall back to the
    // magic-link/OTP send so they still get the link + code by email.
    const otp = await fetch(`${m.base}/otp${redirect}`, {
      method: "POST",
      headers: { apikey: m.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: invite.to, create_user: true, data }),
      signal: AbortSignal.timeout(8000),
    });
    if (!otp.ok) {
      return { sent: false, error: await readError(otp) };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "email_failed" };
  }
}

export interface OrgDeleteCodeEmail {
  to: string;
  orgName: string;
  code: string;
  expiresAt: Date;
  requesterName?: string;
}

/** Organization-deletion verification code via Supabase Auth — the second factor
 * (after the account password) for destroying a workspace. Same best-effort
 * contract as invites: callers surface a manual path when unconfigured.
 *
 * Supabase Auth has no generic send API, so the code rides in `user_metadata`
 * (`{{ .Data.delete_code }}`) on a magic-link/OTP send — the project's Magic
 * Link template must render it (see header). Verification still uses the local
 * `org_delete_codes` table; nothing about the delete flow changes. */
export async function sendOrgDeleteCodeEmail(mail: OrgDeleteCodeEmail): Promise<EmailResult> {
  const m = mailer();
  if (!m) {
    return { sent: false, error: "email_unconfigured" };
  }
  try {
    const res = await fetch(`${m.base}/otp`, {
      method: "POST",
      headers: { apikey: m.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: mail.to,
        create_user: true,
        data: {
          purpose: "org_delete",
          delete_code: mail.code,
          org_name: mail.orgName,
          expires_at: mail.expiresAt.toISOString(),
          ...(mail.requesterName ? { requester_name: mail.requesterName } : {}),
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { sent: false, error: await readError(res) };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "email_failed" };
  }
}
