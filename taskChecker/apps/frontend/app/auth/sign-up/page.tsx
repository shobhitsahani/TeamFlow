"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/overlay";
import { SignupPage, type SignupFormData } from "@/components/ui/sign-up-page";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function SignUpPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (data: SignupFormData) => {
    setError("");
    setSubmitting(true);
    try {
      await signup(data.email, data.password, data.name, data.orgName);
      router.push("/app/board");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SignupPage
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      renderGoogle={(orgName) => (
        <GoogleSignInButton
          text="signup_with"
          variant="custom"
          orgName={orgName}
          onError={setError}
        />
      )}
      onSocial={(provider) =>
        toast({
          title: provider === "github" ? "GitHub sign-up isn't supported" : "Google sign-up isn't enabled",
          msg:
            provider === "github"
              ? "This workspace only supports Google — use it or continue with email."
              : "Ask your workspace admin to configure OAuth, or continue with email.",
        })
      }
    />
  );
}
