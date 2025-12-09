import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { useStackAuth } from '../auth/StackAuthProvider'
import type { Product } from '../dataAdapter'

type SignUpPageProps = {
  onSignUp: (provider?: string) => Promise<void>
  onSignIn: () => void
  onBack: () => void
  isLoading?: boolean
  user?: { id: string; email: string; firstName?: string; lastName?: string } | null
  cartCount?: number
  wishlistCount?: number
  wishlistFeatureEnabled?: boolean
  products?: Product[]
  productsLoading?: boolean
  productsError?: Error | null
  orderTrackingEnabled?: boolean
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
  onSignOut?: () => void
  onAccount?: () => void
}

export function SignUpPage({
  onSignUp,
  onSignIn,
  onBack,
  isLoading = false,
  user = null,
  cartCount = 0,
  wishlistCount = 0,
  wishlistFeatureEnabled = false,
  products = [],
  productsLoading = false,
  productsError = null,
  orderTrackingEnabled = false,
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
  onSignOut = () => {},
  onAccount = () => {},
}: SignUpPageProps) {
  const navigate = useNavigate()
  const { refreshAuth } = useStackAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      console.log('[SignUp] Attempting registration:', { 
        email: email.trim(), 
        firstName: firstName.trim(), 
        lastName: lastName.trim(),
        phone: phone.trim()
      })

      const { DataGateway } = await import('../services/DataGateway')
      const response = await DataGateway.register(
        email.trim(),
        password,
        firstName.trim() && lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : undefined
      )

      if (response.error) {
        console.error('[SignUp] Registration failed:', response.error)
        // Handle validation errors
        if (response.error.details) {
          const details = response.error.details as any
          if (Array.isArray(details)) {
            setError(details.join(', '))
          } else if (typeof details === 'string') {
            setError(details)
          } else {
            setError(response.error.message || 'Failed to create account. Please try again.')
          }
        } else {
          setError(response.error.message || 'Failed to create account. Please try again.')
        }
        setIsSubmitting(false)
        return
      }

      // Success - automatically log in the user (cookie is set)
      console.log('[SignUp] Registration successful:', data)
      setIsSubmitting(false)
      
      // Check if we should return to checkout (user was in checkout flow)
      const returnToCheckout = sessionStorage.getItem('return_to_checkout') === 'true'
      if (returnToCheckout) {
        console.log('[SignUp] User was in checkout, will return to checkout after auth')
        sessionStorage.removeItem('return_to_checkout')
        // Use full page reload to ensure cookie is picked up and App.tsx can handle redirect
        window.location.href = '/'
        return
      }
      
      // Always redirect to profile page after successful sign up
      // Use full page reload to ensure cookie is properly set and auth state is refreshed
      console.log('[SignUp] Redirecting to profile page...')
      window.location.href = '/profile'
    } catch (err) {
      console.error('Sign up error:', err)
      setError('Network error. Please check your connection and try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <Header
        user={user}
        isLoading={isLoading || false}
        cartCount={cartCount || 0}
        wishlistCount={wishlistCount || 0}
        wishlistFeatureEnabled={wishlistFeatureEnabled || false}
        products={products || []}
        onSignIn={onSignIn}
        onSignOut={onSignOut || (() => {})}
        onAccount={onAccount || (() => {})}
        onCart={onCart || (() => {})}
        onWishlist={onWishlist || (() => {})}
        onSearch={onSearch || (() => {})}
        onProductSelect={onProductSelect || (() => {})}
      />
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pt-40 pb-8 sm:px-6 sm:pt-48 lg:px-8 lg:pt-56">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Create Account</h1>
            <p className="mt-2 text-sm text-slate-400">
              Sign up to get started with faster checkout and order tracking
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
            {/* Value Proposition */}
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
              <p className="mb-2 text-sm font-semibold text-white">Why create an account?</p>
              <ul className="space-y-1 text-xs text-slate-300">
                <li>• Faster checkout with saved information</li>
                <li>• Track all your orders in one place</li>
                <li>• Save favorite items to your wishlist</li>
                <li>• Get exclusive offers and updates</li>
              </ul>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              {error && (
                <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value)
                    setError(null)
                  }}
                  placeholder="John"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value)
                    setError(null)
                  }}
                  placeholder="Doe"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                  required
                />
              </div>

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
                  className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Phone number <span className="text-xs text-slate-400">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setError(null)
                  }}
                  placeholder="(513) 555-1234"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-400">
                  We'll use this to contact you about your orders
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError(null)
                    }}
                    placeholder="Create a password"
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

              <button
                type="submit"
                className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand disabled:opacity-50"
                disabled={isLoading || isSubmitting || !email || !password || !firstName || !lastName}
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            {/* Sign In Link */}
            <div className="text-center text-sm text-slate-400">
              Already have an account?{' '}
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
        orderTrackingEnabled={orderTrackingEnabled || false}
        onTrackOrder={onTrackOrder || (() => {})}
        onContactUs={onContactUs || (() => {})}
        onAboutUs={onAboutUs || (() => {})}
        onShippingReturns={onShippingReturns || (() => {})}
        onPrivacyPolicy={onPrivacyPolicy || (() => {})}
        onTermsOfService={onTermsOfService || (() => {})}
      />
    </div>
  )
}

