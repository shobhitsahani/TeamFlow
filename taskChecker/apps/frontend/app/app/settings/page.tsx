"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, memo } from "react";
import { useTenant } from "@/components/store";
import { useAuth } from "@/lib/auth";
import { Modal, useToast } from "@/components/overlay";
import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { IconUsers, IconWebhook, IconFileText, IconSettings, IconChevronRight, IconTrash, IconAlert, IconMail, IconKey, IconLogout } from "@/components/icons";
import { api, getCurrentTenantId } from "@/lib/api";

// Hoist static JSX outside component (rendering-hoist-jsx)
interface SettingsSection {
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly icon: React.ComponentType<{ size?: number }>;
}

const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { href: "/app/settings/members", title: "Members", description: "Manage team members and roles", icon: IconUsers },
  // { href: "/app/settings/usage", title: "Usage & plan", description: "View usage meters and subscription tier", icon: IconCreditCard }, // usage commented out
  { href: "/app/settings/integrations", title: "Integrations", description: "Webhooks and API keys", icon: IconWebhook },
  { href: "/app/settings/audit", title: "Audit log", description: "Security and admin activity trail", icon: IconFileText },
] as const;

/**
 * rerender-memo: Memoize SectionCard to prevent unnecessary re-renders
 */
const SectionCard = memo(function SectionCard({ section }: { section: typeof SETTINGS_SECTIONS[0] }) {
  return (
    <Link href={section.href} className="settings-card">
      <div className="settings-card-icon">
        <section.icon size={20} />
      </div>
      <div className="settings-card-content">
        <h3>{section.title}</h3>
        <p>{section.description}</p>
      </div>
      <IconChevronRight size={16} className="dim" />
    </Link>
  );
});

interface DeleteCodeInfo {
  expiresAt: string;
  email: string;
  /** Why the mail did not go out (email_unconfigured, resend_403: …). */
  reason?: string;
  code?: string;
  devFallback?: boolean;
}

/** Danger zone — owner-only permanent organization deletion.
 * Two factors: the owner's account password plus a single-use code emailed
 * (Resend) to their own address. Deleting removes every project, task,
 * message, and member; users (global accounts) are untouched. */
function DangerZone() {
  const { org, setOrg } = useTenant();
  const { refreshUser } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const orgId = getCurrentTenantId();
  const [open, setOpen] = useState(false);
  const [codeInfo, setCodeInfo] = useState<DeleteCodeInfo | null>(null);
  const [sending, setSending] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (org?.role !== "owner" || !orgId) return null;

  const close = () => {
    if (sending || deleting) return;
    setOpen(false);
    setCodeInfo(null);
    setPassword("");
    setCode("");
  };

  const handleSendCode = async () => {
    if (sending) return;
    setSending(true);
    try {
      const res = await api.orgs.requestDeleteCode(orgId);
      setCodeInfo({
        expiresAt: res.expiresAt,
        email: res.email,
        reason: res.reason,
        code: res.code,
        devFallback: res.devFallback,
      });
      toast({
        title: res.sent ? "Verification code sent" : "Email not sent",
        msg: res.sent
          ? `A 6-digit code is on its way to ${res.email} (expires in 15 minutes).`
          : res.reason === "email_unconfigured"
            ? "Outbound email is not configured (RESEND_API_KEY / INVITE_FROM_EMAIL) — use the fallback code below."
            : `Resend refused the send (${res.reason ?? "unknown error"}) — use the fallback code below.`,
        kind: res.sent ? "ok" : "err",
      });
    } catch (err) {
      toast({ title: "Couldn't send code", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    const cleanCode = code.replace(/[\s-]+/g, "");
    if (!password || !cleanCode || deleting) return;
    setDeleting(true);
    try {
      const res = await api.orgs.deleteOrg(orgId, { password, code: cleanCode });
      toast({ title: "Organization deleted", msg: `${org.name} and all its data were permanently removed.` });
      setOpen(false);
      setCodeInfo(null);
      setPassword("");
      setCode("");
      if (res.switchTo) {
        await setOrg(res.switchTo);
      } else {
        try {
          window.localStorage.removeItem("tf.org.v1");
        } catch {
          // storage unavailable — session-only preference
        }
        await refreshUser();
      }
      router.push("/app/work");
    } catch (err) {
      toast({ title: "Delete failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="settings-card settings-danger">
        <div className="settings-card-icon">
          <IconAlert size={20} />
        </div>
        <div className="settings-card-content" style={{ flex: 1, minWidth: 0 }}>
          <h3>Danger zone</h3>
          <p>Permanently delete {org.name} and all of its data. This cannot be undone.</p>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <IconTrash size={14} /> Delete organization
        </Button>
      </div>

      <Modal
        open={open}
        onClose={close}
        title={`Delete ${org.name}?`}
        sub="This permanently removes every project, task, message, and member."
        footer={
          codeInfo ? (
            <>
              <Button variant="ghost" onClick={close} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void handleDelete()} disabled={!password || !code.replace(/[\s-]+/g, "") || deleting} loading={deleting}>
                <IconTrash size={14} /> Delete forever
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={close} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={() => void handleSendCode()} disabled={sending} loading={sending}>
                <IconMail size={14} /> Send verification code
              </Button>
            </>
          )
        }
      >
        <FieldGroup>
          {!codeInfo ? (
            <p style={{ fontSize: 13, color: "var(--slate-600)", lineHeight: 1.55 }}>
              To confirm it&apos;s really you, we&apos;ll email a 6-digit verification code to your address.
              You&apos;ll enter that code together with your account password on the next step.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--slate-600)", lineHeight: 1.55 }}>
                Code sent to <strong>{codeInfo.email}</strong>
                {codeInfo.expiresAt ? ` — expires ${new Date(codeInfo.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : null}.
                Enter it below with your account password to delete <strong>{org.name}</strong> forever.
              </p>
              {codeInfo.devFallback && codeInfo.code ? (
                <div className="delete-success-code" role="note">
                  <span>Email couldn&apos;t be sent — your code:</span>
                  <strong>{codeInfo.code}</strong>
                  {codeInfo.reason ? <small>{codeInfo.reason}</small> : null}
                </div>
              ) : null}
              <Field>
                <FieldLabel htmlFor="delete-org-password">Account password</FieldLabel>
                <div className="input-with-icon">
                  <IconKey size={16} />
                  <Input
                    id="delete-org-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your sign-in password"
                    autoComplete="current-password"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleDelete();
                    }}
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="delete-org-code">6-digit email code</FieldLabel>
                <div className="input-with-icon">
                  <IconMail size={16} />
                  <Input
                    id="delete-org-code"
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9\s-]/g, "").slice(0, 9))}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    className="font-mono tracking-[0.3em]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleDelete();
                    }}
                  />
                </div>
                <FieldDescription>Didn&apos;t get it? You can request a new code — the old one stops working.</FieldDescription>
              </Field>
              <Button variant="secondary" size="sm" onClick={() => void handleSendCode()} disabled={sending} loading={sending}>
                <IconMail size={14} /> Resend code
              </Button>
            </>
          )}
        </FieldGroup>
      </Modal>
    </>
  );
}

/** Session — sign out of TeamFlow on this device. Mirrors the sidebar
 * rail's sign-out (same auth context + redirect), surfaced here so users
 * can find it in Settings too. */
function SignOutCard() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      toast({ title: "Signed out", msg: "Session ended — see you soon." });
      router.push("/auth/sign-in");
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <div className="settings-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div className="settings-card-icon">
        <IconLogout size={20} />
      </div>
      <div className="settings-card-content" style={{ flex: 1, minWidth: 0 }}>
        <h3>Session</h3>
        <p>Signed in as {user?.email ?? "…"}. Sign out on this device.</p>
      </div>
      <Button variant="secondary" size="sm" onClick={() => void handleSignOut()} disabled={signingOut} loading={signingOut}>
        <IconLogout size={14} /> Sign out
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const { org } = useTenant();

  return (
    <AppShell>
      <div className="page settings-page">
        <header className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Manage {org?.name ?? "your"} organization settings</p>
          </div>
        </header>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings navigation">
            <ul>
              {SETTINGS_SECTIONS.map(section => (
                <li key={section.href}>
                  <Link href={section.href} className="settings-nav-item">
                    <section.icon size={16} />
                    <span>{section.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="settings-content">
            <div className="settings-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="settings-card-icon">
                <IconSettings size={20} />
              </div>
              <div className="settings-card-content" style={{ flex: 1, minWidth: 0 }}>
                <h3>Appearance</h3>
                <p>Switch between light and dark theme</p>
              </div>
              <ThemeToggle id="settings-theme-mode" />
            </div>
            <SignOutCard />
            <div className="settings-grid">
              {SETTINGS_SECTIONS.map(section => (
                <SectionCard key={section.href} section={section} />
              ))}
            </div>
            <DangerZone />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
