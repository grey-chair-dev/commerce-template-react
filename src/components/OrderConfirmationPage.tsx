import type { CartItem } from './CheckoutReviewPage'
import { moneyFormatter } from '../formatters'

type ShippingForm = {
  email: string
  firstName: string
  lastName: string
  address: string
  city: string
  state: string
  zipCode: string
  phone: string
}

type OrderConfirmationPageProps = {
  orderNumber: string
  cartItems: CartItem[]
  shippingForm: ShippingForm
  cartSubtotal: number
  estimatedShipping: number
  estimatedTax: number
  onViewOrderStatus: () => void
  onGoToDashboard: () => void
  onContinueShopping: () => void
}

export function OrderConfirmationPage({
  orderNumber,
  cartItems,
  shippingForm,
  cartSubtotal,
  estimatedShipping,
  estimatedTax,
  onViewOrderStatus,
  onGoToDashboard,
  onContinueShopping,
}: OrderConfirmationPageProps) {
  const total = cartSubtotal + estimatedShipping + estimatedTax

  const handlePrintReceipt = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
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
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold">Order Confirmed!</h1>
          <p className="mt-2 text-sm text-slate-400">
            Thank you for your purchase. We've received your order and will send you a confirmation
            email shortly.
          </p>
          <p className="mt-1 text-sm font-semibold text-primary">Order #{orderNumber}</p>
        </div>

        <div className="flex flex-1 flex-col gap-8 lg:flex-row">
          {/* Main content */}
          <div className="flex-1 space-y-6">
            {/* Order summary */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
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
              <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal</span>
                  <span>{moneyFormatter.format(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Shipping</span>
                  <span>{moneyFormatter.format(estimatedShipping)}</span>
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

            {/* Shipping info */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold">Shipping Information</h2>
              <div className="space-y-1 text-sm text-slate-300">
                <p>
                  {shippingForm.firstName} {shippingForm.lastName}
                </p>
                <p>{shippingForm.address}</p>
                <p>
                  {shippingForm.city}, {shippingForm.state} {shippingForm.zipCode}
                </p>
                <p>{shippingForm.email}</p>
                {shippingForm.phone && <p>{shippingForm.phone}</p>}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                onClick={onViewOrderStatus}
              >
                View Order Status
              </button>
              <button
                className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                onClick={onGoToDashboard}
              >
                Go to Dashboard
              </button>
              <button
                className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                onClick={handlePrintReceipt}
              >
                Print Receipt
              </button>
            </div>

            <button
              className="w-full rounded-full border border-primary/60 px-4 py-3 text-sm font-semibold text-primary hover:border-primary"
              onClick={onContinueShopping}
            >
              Continue Shopping
            </button>
          </div>

          {/* Sidebar with next steps */}
          <div className="lg:w-80">
            <div className="sticky top-8 rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold">What's Next?</h2>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-white">Confirmation Email</p>
                    <p className="text-xs text-slate-400">
                      Check your inbox at {shippingForm.email} for order details and tracking
                      information.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-white">Order Processing</p>
                    <p className="text-xs text-slate-400">
                      Your order will be processed within 1-2 business days.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-white">Shipping Updates</p>
                    <p className="text-xs text-slate-400">
                      You'll receive email notifications when your order ships and when it's out for
                      delivery.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

