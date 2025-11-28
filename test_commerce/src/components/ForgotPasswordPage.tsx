import { useState } from 'react'

type ForgotPasswordPageProps = {
  onBack: () => void
  onSignIn: () => void
}

export function ForgotPasswordPage({ onBack, onSignIn }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // In production, this would call a password reset API
    setIsSubmitted(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="w-full max-w-md space-y-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
                <svg
                  className="h-8 w-8 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold">Check your email</h1>
              <p className="text-sm text-slate-400">
                We've sent a password reset link to <span className="font-semibold text-white">{email}</span>
              </p>
              <p className="text-xs text-slate-500">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <div className="flex gap-3 pt-4">
                <button
                  className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                  onClick={() => {
                    setIsSubmitted(false)
                    setEmail('')
                  }}
                >
                  Resend Email
                </button>
                <button
                  className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                  onClick={onSignIn}
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Forgot Password?</h1>
            <p className="mt-2 text-sm text-slate-400">
              Enter your email address and we'll send you a link to reset your password
            </p>
          </div>
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
            onClick={onBack}
          >
            Close
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-md space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                  required
                />
                <p className="mt-1 text-xs text-slate-400">
                  Enter the email address associated with your account
                </p>
              </div>

              <button
                type="submit"
                className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand disabled:opacity-50"
                disabled={!email}
              >
                Send Reset Link
              </button>
            </form>

            <div className="text-center text-sm text-slate-400">
              Remember your password?{' '}
              <button
                onClick={onSignIn}
                className="font-semibold text-primary hover:text-primary/80"
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

