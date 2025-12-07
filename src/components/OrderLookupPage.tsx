import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CartItem } from './CheckoutReviewPage'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Product } from '../dataAdapter'

type OrderLookupPageProps = {
  onBack: () => void
  onOrderFound: (orderData: {
    orderNumber: string
    cartItems: CartItem[]
    shippingForm: any
    cartSubtotal: number
    estimatedShipping: number
    estimatedTax: number
  }) => void
  onContactSupport?: () => void
  user?: any
  isLoading?: boolean
  cartCount?: number
  wishlistCount?: number
  wishlistFeatureEnabled?: boolean
  products?: Product[]
  orderTrackingEnabled?: boolean
  onSignIn?: () => void
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

export function OrderLookupPage({
  onBack,
  onOrderFound,
  onContactSupport,
  user,
  isLoading = false,
  cartCount = 0,
  wishlistCount = 0,
  wishlistFeatureEnabled = false,
  products = [],
  orderTrackingEnabled = false,
  onSignIn,
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
}: OrderLookupPageProps) {
  const navigate = useNavigate()
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!orderNumber.trim() || !email.trim()) {
      setError('Please enter both order number and email address.')
      return
    }

    setIsSearching(true)

    try {
      const response = await fetch('/api/order/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          email: email.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Order not found. Please check your order number and email address.')
        setIsSearching(false)
        return
      }

      if (data.success && data.order) {
        // Navigate to order confirmation page with order ID
        navigate(`/order-confirmation?id=${data.order.id}`)
      } else {
        setError('Order not found. Please check your order number and email address.')
      }
    } catch (err) {
      console.error('[Order Lookup] Error:', err)
      setError('An error occurred while looking up your order. Please try again later.')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      {/* Header */}
      <Header
        user={user}
        isLoading={isLoading}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        wishlistFeatureEnabled={wishlistFeatureEnabled}
        products={products}
        onSignIn={onSignIn || (() => {})}
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
            <h1 className="text-3xl font-semibold">Look Up Order</h1>
            <p className="mt-2 text-sm text-slate-400">
              Enter your order number and email to track your order
            </p>
          </div>
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
            onClick={onBack}
          >
            Back
          </button>
        </div>

        {/* Search form */}
        <div className="flex-1">
          <form onSubmit={handleSearch} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Order Number *
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="ORD-XXXXX-XXXXXX"
                className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                required
              />
              <p className="mt-1 text-xs text-slate-400">
                You can find your order number in your confirmation email
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Email Address *
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
                Enter the email address used when placing the order
              </p>
            </div>

            {error && (
              <div className="rounded-2xl border border-secondary/30 bg-secondary/10 p-4">
                <p className="text-sm text-secondary">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                onClick={onBack}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand disabled:opacity-50"
                disabled={isSearching}
              >
                {isSearching ? 'Searching...' : 'Look Up Order'}
              </button>
            </div>
          </form>

          {/* Help section */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-lg font-semibold">Need Help?</h2>
            <div className="space-y-3 text-sm text-slate-300">
              <p>
                <span className="font-medium text-white">Can't find your order number?</span>
                <br />
                Check your email inbox for the order confirmation message we sent when you placed
                your order.
              </p>
              <p>
                <span className="font-medium text-white">Wrong email address?</span>
                <br />
                Make sure you're using the same email address you used during checkout.
              </p>
              <button
                className="mt-4 w-full rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
                onClick={onContactSupport}
              >
                Contact Support
              </button>
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

