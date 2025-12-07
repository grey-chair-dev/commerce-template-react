import { useEffect } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Product } from '../dataAdapter'
import { moneyFormatter } from '../formatters'
import type { User } from '@neondatabase/neon-auth'

type CheckoutAccountPageProps = {
  cartSubtotal: number
  estimatedTax: number
  user?: User | null
  isLoading?: boolean
  cartCount?: number
  wishlistCount?: number
  wishlistFeatureEnabled?: boolean
  products?: Product[]
  orderTrackingEnabled?: boolean
  onContinueAsGuest: () => void
  onSignIn: () => void
  onSignUp: () => void
  onCancel: () => void
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

export function CheckoutAccountPage({
  cartSubtotal,
  estimatedTax,
  user,
  isLoading = false,
  cartCount = 0,
  wishlistCount = 0,
  wishlistFeatureEnabled = false,
  products = [],
  orderTrackingEnabled = false,
  onContinueAsGuest,
  onSignIn,
  onSignUp,
  onCancel,
  onSignOut,
  onRedirectToReview,
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
}: CheckoutAccountPageProps) {
  const total = cartSubtotal + estimatedTax

  const steps = [
    { key: 'account', label: 'Account' },
    { key: 'contact', label: 'Contact' },
    { key: 'review', label: 'Review' },
  ]
  const currentStepIndex = 0

  // Task 1.2: If user is already logged in, redirect to review
  // This is a safety check - the parent should handle this, but if a logged in user
  // somehow reaches here, we'll redirect them to review with their account info
  useEffect(() => {
    if (user && !isLoading && onRedirectToReview) {
      console.log('[CheckoutAccountPage] Logged in user detected, redirecting to review')
      onRedirectToReview()
    }
  }, [user, isLoading, onRedirectToReview])

  // If user is already logged in, don't render the account selection page
  // The parent should redirect them, but as a safety measure, return null
  if (user && !isLoading) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      {/* Header */}
      <Header
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        wishlistFeatureEnabled={wishlistFeatureEnabled}
        products={products}
        orderTrackingEnabled={orderTrackingEnabled}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        onAccount={onAccount}
        onCart={onCart}
        onWishlist={onWishlist}
        onSearch={onSearch}
        onProductSelect={onProductSelect}
        onTrackOrder={onTrackOrder}
        onContactUs={onContactUs}
        onAboutUs={onAboutUs}
        onShippingReturns={onShippingReturns}
        onPrivacyPolicy={onPrivacyPolicy}
        onTermsOfService={onTermsOfService}
      />

      <div className="pt-40 sm:pt-48 md:pt-56">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h1 className="mb-2 text-4xl font-bold">Checkout</h1>
            <p className="mb-8 text-slate-400">
              Choose how you'd like to proceed with your order
            </p>

            {/* Progress indicator */}
            <div className="mb-8 flex items-center gap-2">
              {steps.map((step, index) => (
                <div key={step.key} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      index === currentStepIndex
                        ? 'bg-primary text-white'
                        : index < currentStepIndex
                          ? 'bg-primary/50 text-white'
                          : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      index === currentStepIndex
                        ? 'text-white'
                        : index < currentStepIndex
                          ? 'text-primary'
                          : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-0.5 w-8 ${
                        index < currentStepIndex ? 'bg-primary' : 'bg-white/10'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-1 flex-col gap-8 lg:flex-row">
              {/* Main content */}
              <div className="flex-1">
                <div className="rounded-2xl border border-white/20 bg-white/5 p-8">
                  <h2 className="mb-4 text-2xl font-semibold">Have an account?</h2>
                  <p className="mb-8 text-slate-300">
                    Sign in to save your information and track orders, or continue as a guest.
                  </p>

                  <div className="space-y-4">
                    {/* Sign In Button */}
                    <button
                      onClick={onSignIn}
                      className="w-full rounded-full border-2 border-primary bg-primary/20 px-6 py-4 text-left transition hover:bg-primary/30"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-white">Sign In</p>
                          <p className="text-sm text-slate-300">
                            Use your existing account
                          </p>
                        </div>
                        <svg
                          className="h-6 w-6 text-primary"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </button>

                    {/* Sign Up Button */}
                    <button
                      onClick={onSignUp}
                      className="w-full rounded-full border-2 border-white/20 bg-white/5 px-6 py-4 text-left transition hover:border-white/40 hover:bg-white/10"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-white">Create Account</p>
                          <p className="text-sm text-slate-300">
                            New customer? Sign up for faster checkout
                          </p>
                        </div>
                        <svg
                          className="h-6 w-6 text-white/60"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 py-4">
                      <div className="flex-1 border-t border-white/10" />
                      <span className="text-sm text-slate-400">or</span>
                      <div className="flex-1 border-t border-white/10" />
                    </div>

                    {/* Continue as Guest Button */}
                    <button
                      onClick={onContinueAsGuest}
                      className="w-full rounded-full border-2 border-white/20 bg-white/5 px-6 py-4 text-left transition hover:border-white/40 hover:bg-white/10"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-white">Continue as Guest</p>
                          <p className="text-sm text-slate-300">
                            Checkout without creating an account
                          </p>
                        </div>
                        <svg
                          className="h-6 w-6 text-white/60"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Order summary sidebar */}
              <div className="lg:w-80">
                <div className="sticky top-8 rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-300">
                      <span>Subtotal</span>
                      <span>{moneyFormatter.format(cartSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Tax</span>
                      <span>{moneyFormatter.format(estimatedTax)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-2 text-base font-semibold text-white">
                      <span>Total</span>
                      <span>{moneyFormatter.format(total)}</span>
                    </div>
                  </div>
                  <button
                    onClick={onCancel}
                    className="mt-6 w-full rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
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

