import { useState } from 'react'
import type { Product } from '../dataAdapter'
import { moneyFormatter } from '../formatters'
import { assembleCheckoutPayload, type ContactForm } from '../utils/checkoutPayload'
import { Header } from './Header'
import { Footer } from './Footer'

export type CartItem = Product & { quantity: number }

type PaymentForm = {
  cardNumber: string
  expiryDate: string
  cvv: string
  cardholderName: string
}

type CheckoutReviewPageProps = {
  cartItems: CartItem[]
  contactForm: ContactForm
  paymentForm: PaymentForm | null // Null when using Square hosted checkout
  cartSubtotal: number
  estimatedTax: number
  customerId?: string | null
  user?: any
  isLoading?: boolean
  cartCount?: number
  wishlistCount?: number
  wishlistFeatureEnabled?: boolean
  products?: Product[]
  orderTrackingEnabled?: boolean
  onBack: () => void
  onComplete: (payload?: ReturnType<typeof assembleCheckoutPayload>) => void
  onCancel: () => void
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

export function CheckoutReviewPage({
  cartItems,
  contactForm,
  paymentForm,
  cartSubtotal,
  estimatedTax,
  customerId = null,
  user,
  isLoading = false,
  cartCount = 0,
  wishlistCount = 0,
  wishlistFeatureEnabled = false,
  products = [],
  orderTrackingEnabled = false,
  onBack,
  onComplete,
  onCancel,
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
}: CheckoutReviewPageProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const total = cartSubtotal + estimatedTax

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    
    try {
      // Assemble checkout payload
      const checkoutPayload = assembleCheckoutPayload(
        cartItems,
        contactForm,
        cartSubtotal,
        estimatedTax,
        customerId || null,
      )

      // Log payload for debugging (remove in production or use proper logging)
      console.log('[Checkout] Assembled payload:', checkoutPayload)
      
      // Pass payload to onComplete handler - parent will handle API call
      setIsProcessing(false)
      onComplete(checkoutPayload)
    } catch (error) {
      console.error('[Checkout] Error assembling payload:', error)
    setIsProcessing(false)
      // Still call onComplete to allow error handling in parent
      onComplete(undefined)
    }
  }

  const steps = [
    { key: 'account', label: 'Account' },
    { key: 'contact', label: 'Contact' },
    { key: 'review', label: 'Review' },
  ]
  const currentStepIndex = 2

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
      
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8 sm:px-6 lg:px-8 pt-40 sm:pt-48 md:pt-56">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Review Your Order</h1>
            <p className="mt-2 text-sm text-slate-400">Step 3 of 3</p>
          </div>
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-8 flex items-center gap-2">
          {steps.map((step, index) => (
            <div key={step.key} className="flex flex-1 items-center">
              <div className="flex flex-1 items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                    index <= currentStepIndex
                      ? 'border-primary bg-primary text-white'
                      : 'border-white/20 text-slate-400'
                  }`}
                >
                  {index + 1}
                </div>
                <div
                  className={`ml-2 hidden text-xs sm:block ${
                    index <= currentStepIndex ? 'text-white' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 ${
                    index < currentStepIndex ? 'bg-primary' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-1 flex-col gap-8 lg:flex-row">
          {/* Main content */}
          <div className="flex-1 space-y-6">
            {/* Contact Information (for pickup orders) */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Contact Information</h2>
                <button
                  className="text-sm text-primary hover:text-primary/80"
                  onClick={onBack}
                >
                  Edit
                </button>
              </div>
              <div className="mt-4 space-y-1 text-sm text-slate-300">
                <p>
                  {contactForm.firstName} {contactForm.lastName}
                </p>
                <p>{contactForm.email}</p>
                {contactForm.phone && <p>{contactForm.phone}</p>}
                <p className="mt-2 text-xs text-slate-400">
                  We'll notify you when your order is ready for pickup.
                </p>
              </div>
            </div>

            {/* Payment summary - only show if payment form exists (not using Square hosted checkout) */}
            {paymentForm ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Payment Method</h2>
                  <button
                    className="text-sm text-primary hover:text-primary/80"
                    onClick={onBack}
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-4 space-y-1 text-sm text-slate-300">
                  <p>{paymentForm.cardholderName}</p>
                  <p>
                    •••• •••• •••• {paymentForm.cardNumber.replace(/\s/g, '').slice(-4) || '****'}
                  </p>
                  <p>Expires {paymentForm.expiryDate}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Payment Method</h2>
                </div>
                <div className="mt-4 text-sm text-slate-300">
                  <p>You'll enter your payment information on the secure Square checkout page.</p>
                </div>
              </div>
            )}

            {/* Order items */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold">Order Items</h2>
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <div>
                        <p className="font-medium text-white">{item.name}</p>
                        <p className="text-xs text-slate-400">
                          Qty: {item.quantity} × {moneyFormatter.format(item.price)}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold">
                      {moneyFormatter.format(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                  onClick={onBack}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand disabled:opacity-50"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : `Complete Order • ${moneyFormatter.format(total)}`}
                </button>
              </div>
            </form>
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

