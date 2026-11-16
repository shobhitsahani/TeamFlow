"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useToast, Modal, Button } from "@/components/overlay";
import { LoginPage, type LoginFormData } from "@/components/ui/sign-in-page";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { api } from "@/lib/api";

export default function SignInPage() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Password reset state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState("");

  const handleSubmit = async (data: LoginFormData) => {
    setError("");
    setSubmitting(true);
    try {
      await login(data.email, data.password);
      router.push("/app/board");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    const trimmedEmail = resetEmail.trim();
    if (!trimmedEmail) {
      setResetError("Email is required.");
      return;
    }
    if (!resetPassword) {
      setResetError("New password is required.");
      return;
    }
    if (resetPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }
    if (resetPassword !== resetConfirm) {
      setResetError("Passwords do not match.");
      return;
    }

    setResetSubmitting(true);
    try {
      await api.auth.resetPassword({ email: trimmedEmail, password: resetPassword });
      setResetOpen(false);
      setResetPassword("");
      setResetConfirm("");
      toast({
        title: "Password updated successfully",
        msg: "Your password has been reset. You can now sign in.",
        kind: "ok",
      });
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <>
      <LoginPage
        onSubmit={handleSubmit}
        submitting={submitting}
        error={error}
        onSocial={(provider) =>
          toast({
            title: provider === "github" ? "GitHub sign-in isn't supported" : "Google sign-in isn't enabled",
            msg:
              provider === "github"
                ? "This workspace only supports Google — use it or continue with email."
                : "Ask your workspace admin to configure OAuth, or continue with email.",
            kind: "err",
          })
        }
        renderGoogle={() => (
          <GoogleSignInButton
            text="signin_with"
            variant="custom"
            onError={(message) => toast({ title: "Google sign-in failed", msg: message, kind: "err" })}
          />
        )}
        onForgotPassword={(currentEmail) => {
          setResetEmail(currentEmail || "");
          setResetPassword("");
          setResetConfirm("");
          setResetError("");
          setResetOpen(true);
        }}
      />

      <Modal
        open={resetOpen}
        onClose={() => {
          if (!resetSubmitting) setResetOpen(false);
        }}
        title="Reset password"
        sub="Enter your account email and choose a new password."
        footer={
          <div className="flex w-full items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setResetOpen(false)}
              disabled={resetSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="reset-password-form"
              disabled={resetSubmitting}
              loading={resetSubmitting}
            >
              Reset password
            </Button>
          </div>
        }
      >
        <form id="reset-password-form" onSubmit={handleResetSubmit} className="space-y-4 py-2">
          {resetError ? (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {resetError}
            </p>
          ) : null}

          <div>
            <label htmlFor="reset-email" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Account email
            </label>
            <input
              id="reset-email"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="name@company.com"
              required
              disabled={resetSubmitting}
              className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="reset-password-input" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              New password
            </label>
            <input
              id="reset-password-input"
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
              minLength={8}
              disabled={resetSubmitting}
              className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="reset-confirm-input" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Confirm new password
            </label>
            <input
              id="reset-confirm-input"
              type="password"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="Re-enter new password"
              required
              minLength={8}
              disabled={resetSubmitting}
              className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
