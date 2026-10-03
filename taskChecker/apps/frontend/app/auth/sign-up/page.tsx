"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { SignupPage, type SignupFormData } from "@/components/ui/sign-up-page";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function SignUpPage() {
  const router = useRouter();
  const { signup } = useAuth();
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
        <GoogleSignInButton text="signup_with" orgName={orgName} onError={setError} />
      )}
    />
  );
}
