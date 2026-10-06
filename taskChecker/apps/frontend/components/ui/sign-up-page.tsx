'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardContent } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { AuthCard, AuthError, AuthFieldIcon } from '@/app/auth/card'
import { IconArrowRight, IconEye, IconEyeOff, IconLock, IconMail, IconUser } from '@/components/icons'

export interface SignupFormData {
  name: string
  email: string
  password: string
  orgName: string
}

/* Sign-up on the shared auth shell (same card spec as sign-in and the
 * invite flow): flat muted backdrop, brand lockup, token-driven inputs,
 * Harbor Purple primary via Button/text-primary. Behavior and copy are
 * unchanged — only the divergent split-screen look is retired. `leftPanel`
 * is kept for API compatibility and intentionally not rendered. */
export function SignupPage({
  onSubmit,
  submitting = false,
  error = '',
  renderGoogle,
  leftPanel,
}: {
  onSubmit: (data: SignupFormData) => void | Promise<void>
  submitting?: boolean
  error?: string
  renderGoogle?: (orgName: string) => ReactNode
  /** Retired split-screen brand panel — accepted for compatibility, not rendered. */
  leftPanel?: ReactNode
}) {
  void leftPanel
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    email: '',
    password: '',
    orgName: ''
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void onSubmit(formData)
  }

  return (
    <AuthCard
      sub="Create your account"
      footer={
        <p className="text-[13px] text-muted-foreground">
          Already have an account?{' '}
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

            {renderGoogle ? renderGoogle(formData.orgName) : null}

            {renderGoogle ? (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-[13px]">
                  <span className="bg-card px-2 text-muted-foreground">or with email</span>
                </div>
              </div>
            ) : null}

            <Field>
              <FieldLabel htmlFor="signup-name">Your name</FieldLabel>
              <div className="relative">
                <AuthFieldIcon><IconUser size={16} /></AuthFieldIcon>
                <Input
                  id="signup-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  disabled={submitting}
                  required
                  className="pl-9"
                />
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="signup-email">Email address</FieldLabel>
              <div className="relative">
                <AuthFieldIcon><IconMail size={16} /></AuthFieldIcon>
                <Input
                  id="signup-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Email address"
                  autoComplete="email"
                  disabled={submitting}
                  required
                  className="pl-9"
                />
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="signup-password">Password</FieldLabel>
              <div className="relative">
                <AuthFieldIcon><IconLock size={16} /></AuthFieldIcon>
                <Input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  disabled={submitting}
                  minLength={8}
                  required
                  className="pr-10 pl-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </Button>
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="signup-org">Organization name</FieldLabel>
              <div className="relative">
                <AuthFieldIcon><IconUser size={16} /></AuthFieldIcon>
                <Input
                  id="signup-org"
                  type="text"
                  name="orgName"
                  value={formData.orgName}
                  onChange={handleInputChange}
                  placeholder="Acme Inc"
                  autoComplete="organization"
                  disabled={submitting}
                  required
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This creates your organization workspace. You can invite teammates after.
              </p>
            </Field>

            <Button type="submit" className="mt-1 w-full" disabled={submitting} loading={submitting}>
              Create account
              <IconArrowRight size={16} />
            </Button>
          </FieldGroup>
        </CardContent>
      </form>
    </AuthCard>
  )
}
