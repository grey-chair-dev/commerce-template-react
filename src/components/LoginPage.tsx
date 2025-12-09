import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Product } from '../dataAdapter'

type LoginPageProps = {
  onSignIn: (provider?: string) => Promise<void>
  onSignUp: () => void
  onForgotPassword: () => void
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
  onReturnToCheckout?: () => void
}

export function LoginPage({
  onSignIn,
  onSignUp,
  onForgotPassword,
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
  onReturnToCheckout,
}: LoginPageProps) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      console.log('[Login] Attempting login:', { email: email.trim() })
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: include cookies
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      let data
      try {
        const text = await response.text()
        console.log('[Login] Response status:', response.status, 'Response text:', text)
        if (text) {
          data = JSON.parse(text)
        }
      } catch (parseError) {
        console.error('[Login] Failed to parse response:', parseError)
        setError('Invalid response from server. Please try again.')
        setIsSubmitting(false)
        return
      }

      if (!response.ok) {
        console.error('[Login] Login failed:', data)
        // Handle validation errors
        if (data) {
          if (data.details) {
            if (Array.isArray(data.details)) {
              setError(data.details.join(', '))
            } else {
              setError(data.details)
            }
          } else {
            setError(data.error || 'Failed to sign in. Please try again.')
          }
        } else {
          setError(`Server error (${response.status}). Please try again.`)
        }
        setIsSubmitting(false)
        return
      }

      // Success - cookie is automatically set by the browser
      console.log('[Login] Login successful:', data)
      setIsSubmitting(false)
      
      // For localhost development with cross-port cookies, redirect to home
      // This ensures the cookie is properly available for subsequent requests
      if (window.location.hostname === 'localhost') {
        console.log('[Login] Redirecting to home page...')
        // Navigate to home first, then the page will reload naturally
        window.location.href = '/'
        return
      }
      
      // Small delay to ensure cookie is set before checking auth
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Refresh auth state to recognize the logged-in user
      try {
        await refreshAuth()
        console.log('[Login] Auth state refreshed successfully')
      } catch (refreshError) {
        console.error('[Login] Failed to refresh auth, reloading page:', refreshError)
        // If refresh fails, reload the page to ensure cookie is picked up
        window.location.reload()
        return
      }
      
      // Check if we should return to checkout
      const returnToCheckout = sessionStorage.getItem('return_to_checkout') === 'true'
      if (returnToCheckout) {
        console.log('[Login] Returning to checkout after login')
        sessionStorage.removeItem('return_to_checkout')
        
        // If callback is provided, use it to directly open checkout
        // Otherwise, navigate to home and let useEffect handle it
        if (onReturnToCheckout) {
          onReturnToCheckout()
          // Close login page by navigating to home
          navigate('/')
          return
        }
        
        // Fallback: navigate to home and let useEffect handle checkout
        window.location.href = '/'
        return
      }
      
      // Redirect to profile page after successful login
      navigate('/profile')
    } catch (err) {
      console.error('Login error:', err)
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
            <h1 className="text-3xl font-semibold">Sign In</h1>
            <p className="mt-2 text-sm text-slate-400">
              Sign in to access your account, order history, and saved preferences
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
            {/* Email/Password Form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              {error && (
                <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

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
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      // Pass email to forgot password page via state (not URL)
                      navigate('/forgot-password', {
                        state: { email: email.trim() }
                      })
                    }}
                    className="text-xs text-primary hover:text-primary/80"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError(null)
                    }}
                    placeholder="Enter your password"
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
              </div>

              <button
                type="submit"
                className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand disabled:opacity-50"
                disabled={isLoading || isSubmitting || !email || !password}
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Sign Up Link */}
            <div className="text-center text-sm text-slate-400">
              Don't have an account?{' '}
              <button
                onClick={onSignUp}
                className="font-semibold text-primary hover:text-primary/80"
              >
                Sign up
              </button>
            </div>

            {/* Benefits */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-sm font-semibold text-white">Benefits of signing in:</p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <span>Faster checkout with saved addresses</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <span>Access to order history and tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <span>Save items to your wishlist</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <span>Personalized recommendations</span>
                </li>
              </ul>
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

