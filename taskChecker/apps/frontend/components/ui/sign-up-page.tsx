'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { GradientOrb } from '@/components/ui/gradient-orb'

export interface SignupFormData {
  name: string
  email: string
  password: string
  orgName: string
}

/* Split-screen sign-up matching LoginPage: animated orb left, dark form
 * right. Google OAuth (when configured) renders above the email form via
 * `renderGoogle`, which receives the live org-name field value. */
export function SignupPage({
  onSubmit,
  submitting = false,
  error = '',
  renderGoogle,
  onSocial,
  leftPanel,
}: {
  onSubmit: (data: SignupFormData) => void | Promise<void>
  submitting?: boolean
  error?: string
  renderGoogle?: (orgName: string) => ReactNode
  /** Fallback for the social buttons when no custom renderer is provided.
   * GitHub has no backend support and stays a toast. */
  onSocial?: (provider: 'google' | 'github') => void
  /** Replaces the orb panel. Defaults to the animated gradient orb. */
  leftPanel?: ReactNode
}) {
  const router = useRouter()
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

  const inputCls =
    'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-60'

  return (
    <div className="flex min-h-screen w-screen flex-col gap-6 bg-[#0a0a0a] p-4 sm:gap-8 sm:p-6 lg:h-screen lg:flex-row">
      {/* Left Panel - orb by default, swappable (desktop only) */}
      {leftPanel !== undefined ? (
        <div className="relative hidden flex-1 items-center justify-center overflow-hidden lg:flex">
          {leftPanel}
        </div>
      ) : (
        <div className="relative min-h-72 flex-1 overflow-hidden rounded-2xl lg:min-h-0">
          {/* Back Button */}
          <div className="absolute left-6 top-6 z-10">
            <button
              type="button"
              onClick={() => router.push('/')}
              aria-label="Back to home"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
          </div>

          <div className="absolute inset-0">
            <GradientOrb />
          </div>
        </div>
      )}

      {/* Right Panel - Form Section */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-[#0a0a0a]">
        <div className="w-full max-w-md p-8">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold text-white">
              Create your account
            </h1>
            <p className="text-gray-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/auth/sign-in')}
                className="font-medium text-blue-400 hover:text-blue-300"
              >
                Sign in
              </button>
            </p>
          </div>

          {error ? (
            <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          {/* Social Buttons */}
          <div className="flex flex-col gap-3">
            {renderGoogle ? (
              renderGoogle(formData.orgName)
            ) : (
              <button
                type="button"
                onClick={() => onSocial?.('google')}
                className="flex items-center justify-center rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5"
              >
                {/* Google SVG */}
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-center text-sm font-medium leading-snug text-gray-200">
                  Continue with
                  <br />
                  Google
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onSocial?.('github')}
              className="flex items-center justify-center rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5"
            >
              {/* GitHub SVG */}
              <svg className="mr-2 h-5 w-5" fill="#e6edf3" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="text-center text-sm font-medium leading-snug text-gray-200">
                Continue with
                <br />
                GitHub
              </span>
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-[#0a0a0a] px-2 text-gray-500">or with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="signup-name" className="mb-2 block text-sm font-medium text-gray-300">
                Your name
              </label>
              <input
                id="signup-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Jane Doe"
                autoComplete="name"
                disabled={submitting}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="mb-2 block text-sm font-medium text-gray-300">
                Email Address
              </label>
              <input
                id="signup-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Email Address"
                autoComplete="email"
                disabled={submitting}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="mb-2 block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  disabled={submitting}
                  minLength={8}
                  className={`${inputCls} pr-12`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-white/10"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="signup-org" className="mb-2 block text-sm font-medium text-gray-300">
                Organization name
              </label>
              <input
                id="signup-org"
                type="text"
                name="orgName"
                value={formData.orgName}
                onChange={handleInputChange}
                placeholder="Acme Inc"
                autoComplete="organization"
                disabled={submitting}
                className={inputCls}
                required
              />
              <p className="mt-2 text-xs text-gray-500">
                This creates your organization workspace. You can invite teammates after.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-white px-4 py-3 font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
