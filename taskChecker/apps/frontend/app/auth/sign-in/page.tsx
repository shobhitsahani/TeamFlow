"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/overlay";
import { LoginPage, type LoginFormData } from "@/components/ui/sign-in-page";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function SignInPage() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  return (
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
        })
      }
      renderGoogle={() => (
        <GoogleSignInButton
          text="signin_with"
          variant="custom"
          onError={(message) => toast({ title: "Google sign-in failed", msg: message, kind: "err" })}
        />
      )}
      onForgotPassword={() =>
        toast({
          title: "Password reset isn't enabled",
          msg: "Contact your workspace admin to reset your password.",
        })
      }
    />
  );
}
