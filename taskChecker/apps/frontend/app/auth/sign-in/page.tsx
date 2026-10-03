"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/overlay";
import { LoginPage, type LoginFormData } from "@/components/ui/sign-in-page";

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
          title: `${provider === "google" ? "Google" : "GitHub"} sign-in isn't enabled`,
          msg: "Ask your workspace admin to configure OAuth, or continue with email.",
        })
      }
      onForgotPassword={() =>
        toast({
          title: "Password reset isn't enabled",
          msg: "Contact your workspace admin to reset your password.",
        })
      }
    />
  );
}
