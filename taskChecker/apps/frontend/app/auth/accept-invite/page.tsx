"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { IconLock, IconUser, IconEye, IconEyeOff, IconArrowRight, IconCheck, IconAlertCircle, IconKey } from "@/components/icons";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { AuthCard, AuthError, AuthFieldIcon } from "../card";

type Preview = { email: string; orgName: string; role: string; expiresAt: string };

function expiredCode(preview: Preview): boolean {
  return new Date(preview.expiresAt).getTime() < Date.now();
}

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState("");
  // Join-by-code: the short code from the invite email, typed by hand.
  const [codeInput, setCodeInput] = useState("");
  const [resolvedCode, setResolvedCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.auth
      .previewInvite(token)
      .then((res) => {
        if (!cancelled) setPreview(res.invite);
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : "Invalid invitation link.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleCodeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (!code || codeLoading) return;
    setCodeLoading(true);
    setPreviewError("");
    try {
      const res = await api.auth.previewInviteByCode(code);
      setPreview(res.invite);
      setResolvedCode(code);
    } catch (err) {
      setPreview(null);
      setResolvedCode("");
      setPreviewError(err instanceof Error ? err.message : "Invalid invitation code.");
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (token) {
        await api.auth.acceptInvite(token, { name, password });
      } else {
        await api.auth.acceptInviteByCode(resolvedCode, { name, password });
      }
      setSuccess(true);
      // Redirect after short delay
      setTimeout(() => {
        router.push("/app/work");
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    // Join-by-code: no link token — the recipient types the short code from
    // the invite email, we preview it, then the same accept form applies.
    return (
      <AuthCard
        sub="Join with your invite code"
        footer={
          <p className="text-[13px] text-muted-foreground">
            Have the full link instead? Open it directly.{" "}
            <Link href="/auth/sign-in" className="font-semibold text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        }
      >
        <form onSubmit={handleCodeLookup}>
          <CardContent>
            <FieldGroup>
              {preview ? (
                <div className={expiredCode(preview) ? "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px]" : "rounded-lg border bg-muted/50 px-3 py-2.5 text-[13px]"}>
                  <p>
                    <strong>{preview.email}</strong> — invited to <strong>{preview.orgName}</strong> as{" "}
                    <strong>{preview.role}</strong>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {expiredCode(preview)
                      ? "This invite has expired — ask for a fresh one."
                      : `Invite expires ${new Date(preview.expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
                  </p>
                </div>
              ) : (
                <>
                  {previewError ? <AuthError message={previewError} /> : null}
                  <Field>
                    <FieldLabel htmlFor="invite-code">Invite code</FieldLabel>
                    <div className="relative">
                      <AuthFieldIcon><IconKey size={16} /></AuthFieldIcon>
                      <Input
                        id="invite-code"
                        type="text"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                        placeholder="ABCDEFGH"
                        required
                        autoComplete="one-time-code"
                        disabled={codeLoading}
                        maxLength={8}
                        className="pl-9 font-mono tracking-[0.2em] uppercase"
                      />
                    </div>
                  </Field>
                  <Button type="submit" className="mt-1 w-full" disabled={!codeInput.trim() || codeLoading} loading={codeLoading}>
                    Find invite
                    <IconArrowRight size={16} />
                  </Button>
                </>
              )}
            </FieldGroup>
          </CardContent>
        </form>

        {preview ? (
          <form onSubmit={handleSubmit}>
            <CardContent>
              <FieldGroup>
                {error ? <AuthError message={error} /> : null}
                <Field>
                  <FieldLabel htmlFor="name">Your name</FieldLabel>
                  <div className="relative">
                    <AuthFieldIcon><IconUser size={16} /></AuthFieldIcon>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                      autoComplete="name"
                      disabled={loading || expiredCode(preview)}
                      className="pl-9"
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <div className="relative">
                    <AuthFieldIcon><IconLock size={16} /></AuthFieldIcon>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="•••••••• (min 8 characters)"
                      required
                      autoComplete="new-password"
                      disabled={loading || expiredCode(preview)}
                      minLength={8}
                      className="pr-10 pl-9"
                    />
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute top-1/2 right-1 -translate-y-1/2">
                      {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </Button>
                  </div>
                </Field>
                <Button type="submit" className="mt-1 w-full" disabled={loading || expiredCode(preview)} loading={loading}>
                  Accept invite
                  <IconArrowRight size={16} />
                </Button>
              </FieldGroup>
            </CardContent>
          </form>
        ) : null}
      </AuthCard>
    );
  }

  if (success) {
    return (
      <AuthCard sub="Welcome to your new organization!">
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
              <IconCheck size={24} />
            </span>
            <h2 className="text-lg font-semibold">Invite accepted</h2>
            <p className="text-sm text-muted-foreground">Redirecting to your workspace…</p>
          </div>
        </CardContent>
      </AuthCard>
    );
  }

  const expired = preview ? new Date(preview.expiresAt).getTime() < new Date().getTime() : false;

  return (
    <AuthCard
      sub="Accept your invitation"
      footer={
        <p className="text-[13px] text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="font-semibold text-primary hover:underline">
            Sign in instead
          </Link>
          {" · "}
          <Link href="/auth/accept-invite" className="font-semibold text-primary hover:underline">
            Have a code instead?
          </Link>
        </p>
      }
    >
        <form onSubmit={handleCodeLookup}>
          <CardContent>
            <FieldGroup>
              {preview ? (
              <div className={expired ? "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px]" : "rounded-lg border bg-muted/50 px-3 py-2.5 text-[13px]"}>
                <p>
                  <strong>{preview.email}</strong> — invited to <strong>{preview.orgName}</strong> as{" "}
                  <strong>{preview.role}</strong>
                </p>
                <p className="mt-1 text-muted-foreground">
                  {expired
                    ? "This link has expired — ask for a fresh invite."
                    : `Link expires ${new Date(preview.expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
                </p>
              </div>
            ) : previewError ? (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
                <IconAlertCircle size={16} /> {previewError}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Checking invitation…</p>
            )}

            {error ? <AuthError message={error} /> : null}

            <Field>
              <FieldLabel htmlFor="name">Your name</FieldLabel>
              <div className="relative">
                <AuthFieldIcon><IconUser size={16} /></AuthFieldIcon>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  autoComplete="name"
                  disabled={loading || expired}
                  className="pl-9"
                />
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <div className="relative">
                <AuthFieldIcon><IconLock size={16} /></AuthFieldIcon>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••• (min 8 characters)"
                  required
                  autoComplete="new-password"
                  disabled={loading || expired}
                  minLength={8}
                  className="pr-10 pl-9"
                />
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute top-1/2 right-1 -translate-y-1/2">
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </Button>
              </div>
            </Field>

            <Button type="submit" className="mt-1 w-full" disabled={loading || expired} loading={loading}>
              Accept invite
              <IconArrowRight size={16} />
            </Button>
          </FieldGroup>
        </CardContent>
      </form>
    </AuthCard>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="auth-container flex flex-col gap-3" role="status" aria-label="Loading invite"><Skeleton className="h-8 w-48 rounded" /><Skeleton className="h-12 w-full rounded-lg" /><Skeleton className="h-12 w-full rounded-lg" /></div></div>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
