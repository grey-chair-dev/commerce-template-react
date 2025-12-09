import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Product } from '../dataAdapter'

type ForgotPasswordPageProps = {
  onBack: () => void
  onSignIn: () => void
  user?: any
  isLoading?: boolean
  cartCount?: number
  wishlistCount?: number
  wishlistFeatureEnabled?: boolean
  products?: Product[]
  orderTrackingEnabled?: boolean
  onSignOut?: () => void
  onAccount?: () => void
  onCart?: () => void
  onWishlist?: () => void
  onSearch?: () => void
  onProductSelect?: (product: Product) => void
  onTrackOrder?: () => void
  onContactUs?: () => void
  onAboutUs?: () => void
  onShippingReturns?: () => void
  onPrivacyPolicy?: () => void
  onTermsOfService?: () => void
}

export function ForgotPasswordPage({
  onBack,
  onSignIn,
  user,
  isLoading = false,
  cartCount = 0,
  wishlistCount = 0,
  wishlistFeatureEnabled = false,
  products = [],
  orderTrackingEnabled = false,
  onSignOut,
  onAccount,
  onCart,
  onWishlist,
  onSearch,
  onProductSelect,
  onTrackOrder,
  onContactUs,
  onAboutUs,
  onShippingReturns,
  onPrivacyPolicy,
  onTermsOfService,
}: ForgotPasswordPageProps) {
  const location = useLocation()
  // Get email from navigation state (not URL)
  const emailFromState = location.state?.email || ''
  const [email, setEmail] = useState(emailFromState)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update email if state changes (when navigating from login)
  useEffect(() => {
    const stateEmail = location.state?.email || ''
    if (stateEmail && stateEmail !== email) {
      setEmail(stateEmail)
    }
  }, [location.state, email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitted(false) // Don't show success until we confirm email exists

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    try {
      console.log('[Forgot Password] Submitting request for:', email.trim())
      const { DataGateway } = await import('../services/DataGateway')
      const response = await DataGateway.forgotPassword(email.trim())

      if (response.error) {
        console.error('[Forgot Password] Request failed:', response.error)
        // Show error message if email not found
        if (response.error.status === 404 || response.error.message?.includes('not found')) {
          setError('No account found with this email address. Please check your email or sign up for a new account.')
        } else {
          setError(response.error.message || 'Failed to send reset email. Please try again.')
        }
        setIsSubmitting(false)
        return
      }

      // Success - email sent
      console.log('[Forgot Password] Reset email sent successfully')
      setIsSubmitted(true)
      setError(null)
    } catch (err) {
      console.error('[Forgot Password] Network error:', err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
        <Header
          user={user}
          isLoading={isLoading}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          wishlistFeatureEnabled={wishlistFeatureEnabled}
          products={products}
          onSignIn={onSignIn}
          onSignOut={onSignOut || (() => {})}
          onAccount={onAccount || (() => {})}
          onCart={onCart || (() => {})}
          onWishlist={onWishlist || (() => {})}
          onSearch={onSearch || (() => {})}
          onProductSelect={onProductSelect || (() => {})}
        />
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:px-6 lg:px-8 pt-40 sm:pt-48 md:pt-56">
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
                  onClick={async () => {
                    // Resend email with the same email address
                    setError(null)
                    setIsSubmitted(false)
                    
                    if (!email.trim()) {
                      setError('Email address is missing. Please try again.')
                      return
                    }

                    try {
                      console.log('[Forgot Password] Resending email for:', email.trim())
                      const { DataGateway } = await import('../services/DataGateway')
                      const response = await DataGateway.forgotPassword(email.trim())

                      if (response.error) {
                        console.error('[Forgot Password] Resend request failed:', response.error)
                        if (response.error.status === 404 || response.error.message?.includes('not found')) {
                          setError('No account found with this email address.')
                        } else {
                          setError(response.error.message || 'Failed to resend email. Please try again.')
                        }
                        return
                      }

                      // Success - email resent
                      console.log('[Forgot Password] Email resent successfully')
                      setIsSubmitted(true)
                      setError(null)
                    } catch (err) {
                      console.error('[Forgot Password] Resend network error:', err)
                      setError('Network error. Please check your connection and try again.')
                    }
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
        <Footer
          orderTrackingEnabled={orderTrackingEnabled}
          onTrackOrder={onTrackOrder || (() => {})}
          onContactUs={onContactUs || (() => {})}
          onAboutUs={onAboutUs}
          onShippingReturns={onShippingReturns}
          onPrivacyPolicy={onPrivacyPolicy}
          onTermsOfService={onTermsOfService}
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <Header
        user={user}
        isLoading={isLoading}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        wishlistFeatureEnabled={wishlistFeatureEnabled}
        products={products}
        onSignIn={onSignIn}
        onSignOut={onSignOut || (() => {})}
        onAccount={onAccount || (() => {})}
        onCart={onCart || (() => {})}
        onWishlist={onWishlist || (() => {})}
        onSearch={onSearch || (() => {})}
        onProductSelect={onProductSelect || (() => {})}
      />
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:px-6 lg:px-8 pt-40 sm:pt-48 md:pt-56">
        {/* Close button - top right */}
        <div className="mb-4 flex justify-end">
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40 transition-colors"
            onClick={onBack}
          >
            Close
          </button>
        </div>

        {/* Centered content */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-md space-y-6">
            {/* Header */}
            <div className="text-center">
              <h1 className="text-3xl font-semibold">Forgot Password?</h1>
              <p className="mt-3 text-sm text-slate-400">
                Enter your email address and we'll send you a link to reset your password
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError(null)
                  }}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:bg-white/10 focus:outline-none transition-colors"
                  required
                  autoFocus
                />
                <p className="mt-2 text-xs text-slate-400">
                  Enter the email address associated with your account
                </p>
              </div>

              <button
                type="submit"
                className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!email || isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            {/* Sign in link */}
            <div className="text-center text-sm text-slate-400">
              Remember your password?{' '}
              <button
                onClick={onSignIn}
                className="font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer
        orderTrackingEnabled={orderTrackingEnabled}
        onTrackOrder={onTrackOrder || (() => {})}
        onContactUs={onContactUs || (() => {})}
        onAboutUs={onAboutUs}
        onShippingReturns={onShippingReturns}
        onPrivacyPolicy={onPrivacyPolicy}
        onTermsOfService={onTermsOfService}
      />
    </div>
  )
}

