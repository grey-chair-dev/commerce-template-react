import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Product } from '../dataAdapter'

type ResetPasswordPageProps = {
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

export function ResetPasswordPage({
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
}: ResetPasswordPageProps) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isValidatingToken, setIsValidatingToken] = useState(true)
  const [tokenExpired, setTokenExpired] = useState(false)
  const [tokenEmail, setTokenEmail] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const token = searchParams.get('token')

  // Validate token on page load
  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.')
      setIsValidatingToken(false)
      return
    }

    // Check token validity by making a lightweight request (without password)
    const validateToken = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${apiUrl}/auth/reset-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            token,
            // No password - API will return token status and email
          }),
        })

        const text = await response.text()
        const data = text ? JSON.parse(text) : {}

        if (!response.ok) {
          // Check if token is expired, used, or invalid
          if (data.error === 'Token expired' || data.error === 'Token already used' || data.error === 'Invalid token') {
            setTokenExpired(true)
            // Store email from token if available
            if (data.email) {
              setTokenEmail(data.email)
            }
            if (data.error === 'Token expired') {
              setError('This password reset link has expired. Please request a new one.')
            } else if (data.error === 'Token already used') {
              setError('This password reset link has already been used. Please request a new one.')
            } else {
              setError('This password reset link is invalid. Please request a new one.')
            }
          } else {
            // Unknown error - assume token might be valid and let user try
            setError(null)
            setTokenExpired(false)
          }
        } else {
          // Token is valid - store email if provided
          if (data.email) {
            setTokenEmail(data.email)
          }
          setError(null)
          setTokenExpired(false)
        }
      } catch (err) {
        console.error('[Reset Password] Error validating token:', err)
        // Don't show error - let user try to submit
        setError(null)
      } finally {
        setIsValidatingToken(false)
      }
    }

    validateToken()
  }, [token])

  // Handle resending reset email
  const handleResendResetEmail = async () => {
    if (!tokenEmail) {
      // Fallback to forgot password page if we don't have email
      onBack()
      return
    }

    setIsResending(true)
    setError(null)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: tokenEmail,
        }),
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (response.ok) {
        setResendSuccess(true)
        setError(null)
      } else {
        setError(data.message || 'Failed to send reset email. Please try again.')
      }
    } catch (err) {
      console.error('[Reset Password] Error resending email:', err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Invalid reset link. Please request a new password reset.')
      return
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password strength (client-side check, server will also validate)
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter')
      return
    }

    // Check for lowercase letter
    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter')
      return
    }

    // Check for number
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number')
      return
    }

    setIsSubmitting(true)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          token,
          password,
        }),
      })

      let data
      try {
        const text = await response.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (parseError) {
        console.error('[Reset Password] Failed to parse response:', parseError)
        setError('Invalid response from server. Please try again.')
        setIsSubmitting(false)
        return
      }

      if (!response.ok) {
        console.error('[Reset Password] Reset failed:', data)
        setError(data.message || data.error || 'Failed to reset password. Please try again.')
        setIsSubmitting(false)
        return
      }

      // Success
      console.log('[Reset Password] Password reset successful')
      setSuccess(true)
      setIsSubmitting(false)

      // Redirect to login after 3 seconds
      setTimeout(() => {
        onSignIn()
      }, 3000)
    } catch (err) {
      console.error('Reset password error:', err)
      setError('Network error. Please check your connection and try again.')
      setIsSubmitting(false)
    }
  }

  if (success) {
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
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <svg
                  className="h-8 w-8 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold">Password Reset Successful!</h1>
              <p className="text-sm text-slate-400">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <p className="text-xs text-slate-500">
                Redirecting to sign in page...
              </p>
              <button
                className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                onClick={onSignIn}
              >
                Go to Sign In
              </button>
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
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Reset Password</h1>
            <p className="mt-2 text-sm text-slate-400">
              Enter your new password below
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
            {error && (
              <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {isValidatingToken && (
              <div className="rounded-2xl border border-white/20 bg-white/5 p-4 text-sm text-slate-300">
                <p>Validating reset link...</p>
              </div>
            )}

            {!token && !isValidatingToken && (
              <div className="rounded-2xl border border-yellow-500/50 bg-yellow-500/10 p-4 text-sm text-yellow-400">
                <p className="font-semibold mb-2">Invalid Reset Link</p>
                <p>This password reset link is invalid. Please request a new password reset.</p>
                <button
                  onClick={onBack}
                  className="mt-3 text-primary hover:text-primary/80 font-semibold"
                >
                  Go to Forgot Password
                </button>
              </div>
            )}

            {tokenExpired && !isValidatingToken && !resendSuccess && (
              <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
                <p className="font-semibold mb-2">Reset Link Expired</p>
                <p className="mb-3">This password reset link has expired or has already been used. For security, reset links expire after 1 hour.</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleResendResetEmail}
                    disabled={isResending}
                    className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResending ? 'Sending...' : 'Request New Reset Link'}
                  </button>
                  <button
                    onClick={onSignIn}
                    className="flex-1 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            )}

            {resendSuccess && (
              <div className="rounded-2xl border border-green-500/50 bg-green-500/10 p-4 text-sm text-green-400">
                <p className="font-semibold mb-2">Reset Link Sent!</p>
                <p className="mb-3">We've sent a new password reset link to <span className="font-semibold text-white">{tokenEmail}</span>. Please check your email.</p>
                <div className="flex gap-3">
                  <button
                    onClick={onSignIn}
                    className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-primary/90"
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            )}

            {token && !tokenExpired && !isValidatingToken && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setError(null)
                      }}
                      placeholder="Enter your new password"
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 pr-10 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Must be at least 8 characters long, with uppercase, lowercase, and a number
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        setError(null)
                      }}
                      placeholder="Confirm your new password"
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 pr-10 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand disabled:opacity-50"
                  disabled={isSubmitting || !password || !confirmPassword || !token}
                >
                  {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
                </button>
              </form>
            )}

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

