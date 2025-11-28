import { useState } from 'react'
import type { CartItem } from './CheckoutReviewPage'

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
}

// Mock order storage - in production, this would be fetched from an API
const mockOrders: Record<string, any> = {}

export function OrderLookupPage({ onBack, onOrderFound, onContactSupport }: OrderLookupPageProps) {
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

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Check mock orders or simulate finding an order
    // In production, this would query your backend/API
    const foundOrder = mockOrders[orderNumber.toLowerCase()]

    if (foundOrder && foundOrder.shippingForm.email.toLowerCase() === email.toLowerCase()) {
      onOrderFound(foundOrder)
    } else {
      setError('Order not found. Please check your order number and email address.')
    }

    setIsSearching(false)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:px-6 lg:px-8">
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
    </div>
  )
}

