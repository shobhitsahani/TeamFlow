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
  leftPanel,
}: {
  onSubmit: (data: SignupFormData) => void | Promise<void>
  submitting?: boolean
  error?: string
  renderGoogle?: (orgName: string) => ReactNode
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
        <div className="relative hidden flex-1 overflow-hidden rounded-2xl lg:block">
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

          {renderGoogle ? renderGoogle(formData.orgName) : null}

          {renderGoogle ? (
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-[#0a0a0a] px-2 text-gray-500">or with email</span>
              </div>
            </div>
          ) : null}

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
