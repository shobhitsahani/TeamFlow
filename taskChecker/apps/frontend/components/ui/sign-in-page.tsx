'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardContent } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { AuthCard, AuthError, AuthFieldIcon } from '@/app/auth/card'
import { IconArrowRight, IconEye, IconEyeOff, IconLock, IconMail } from '@/components/icons'

export interface LoginFormData {
  email: string
  password: string
  rememberMe: boolean
}

/* Sign-in on the shared auth shell (same card spec as sign-up and the
 * invite flow): flat muted backdrop, brand lockup, token-driven inputs,
 * Harbor Purple primary via Button/text-primary. Behavior and copy are
 * unchanged — only the divergent split-screen look is retired. `leftPanel`
 * is kept for API compatibility and intentionally not rendered. */
export function LoginPage({
  onSubmit,
  submitting = false,
  error = '',
  onSocial,
  onForgotPassword,
  leftPanel,
  renderGoogle,
}: {
  onSubmit: (data: LoginFormData) => void | Promise<void>
  submitting?: boolean
  error?: string
  onSocial?: (provider: 'google' | 'github') => void
  onForgotPassword?: () => void
  /** Retired split-screen brand panel — accepted for compatibility, not rendered. */
  leftPanel?: ReactNode
  /** Real Google button (mirrors sign-up's renderGoogle). When provided it
   * replaces the dead placeholder; GitHub has no backend support and stays
   * a toast. */
  renderGoogle?: () => ReactNode
}) {
  void leftPanel
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void onSubmit(formData)
  }

  return (
    <AuthCard
      sub="Welcome back"
      footer={
        <p className="text-[13px] text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/sign-up" className="font-semibold text-primary hover:underline">
            Sign up
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit}>
        <CardContent>
          <FieldGroup>
            {error ? <AuthError message={error} /> : null}

            <Field>
              <FieldLabel htmlFor="login-email">Email address</FieldLabel>
              <div className="relative">
                <AuthFieldIcon><IconMail size={16} /></AuthFieldIcon>
                <Input
                  id="login-email"
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
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <div className="relative">
                <AuthFieldIcon><IconLock size={16} /></AuthFieldIcon>
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Password"
                  autoComplete="current-password"
                  disabled={submitting}
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

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                  disabled={submitting}
                  className="size-4 accent-primary"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-[13px] font-semibold text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" className="mt-1 w-full" disabled={submitting} loading={submitting}>
              Sign in
              <IconArrowRight size={16} />
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-[13px]">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {renderGoogle ? (
                renderGoogle()
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onSocial?.('google')}
                >
                  {/* Google SVG */}
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="text-sm font-medium">
                    Continue with Google
                  </span>
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => onSocial?.('github')}
              >
                {/* GitHub SVG */}
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <span className="text-sm font-medium">
                  Continue with GitHub
                </span>
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </form>
    </AuthCard>
  )
}
