"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconMail, IconLock, IconUser, IconBuilding, IconEye, IconEyeOff, IconArrowRight } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { CardContent } from "@/components/ui/card";
import { AuthCard, AuthError, AuthFieldIcon } from "../card";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function SignUpPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signup(email, password, name, orgName);
      router.push("/app/board");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      sub="Create your organization and account"
      footer={
        <p className="text-[13px] text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
        <form onSubmit={handleSubmit}>
          <CardContent>
            <FieldGroup>
            {error ? <AuthError message={error} /> : null}

            <GoogleSignInButton text="signup_with" orgName={orgName} onError={setError} />

            <div className="flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or with email</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Field>
              <FieldLabel htmlFor="name">Your name</FieldLabel>
              <div className="relative">
                <AuthFieldIcon><IconUser size={16} /></AuthFieldIcon>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  autoComplete="name"
                  disabled={loading}
                  className="pl-9"
                />
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <div className="relative">
                <AuthFieldIcon><IconMail size={16} /></AuthFieldIcon>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                  disabled={loading}
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
                  onChange={e => setPassword(e.target.value)}
                  placeholder="•••••••• (min 8 characters)"
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  minLength={8}
                  className="pr-10 pl-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </Button>
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="orgName">Organization name</FieldLabel>
              <div className="relative">
                <AuthFieldIcon><IconBuilding size={16} /></AuthFieldIcon>
                <Input
                  id="orgName"
                  type="text"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Acme Inc"
                  required
                  autoComplete="organization"
                  disabled={loading}
                  className="pl-9"
                />
              </div>
              <FieldDescription>This creates your organization workspace. You can invite teammates after.</FieldDescription>
            </Field>

            <Button type="submit" className="mt-1 w-full" disabled={loading} loading={loading}>
              Create account
              <IconArrowRight size={16} />
            </Button>
            </FieldGroup>
          </CardContent>
        </form>
    </AuthCard>
  );
}
