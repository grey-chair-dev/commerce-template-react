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

type OrderStatus = 'confirmed' | 'packed' | 'shipped' | 'delivered'

type OrderStatusPageProps = {
  orderNumber: string
  cartItems: CartItem[]
  shippingForm: ShippingForm
  cartSubtotal: number
  estimatedShipping: number
  estimatedTax: number
  currentStatus: OrderStatus
  trackingNumber?: string
  estimatedDeliveryDate?: string
  onBack: () => void
  onContactSupport?: () => void
}

const statusSteps: { key: OrderStatus; label: string; description: string }[] = [
  { key: 'confirmed', label: 'Order Confirmed', description: 'Your order has been received' },
  { key: 'packed', label: 'Packed', description: 'Items are being prepared for shipment' },
  { key: 'shipped', label: 'Shipped', description: 'Your order is on the way' },
  { key: 'delivered', label: 'Delivered', description: 'Order has been delivered' },
]

export function OrderStatusPage({
  orderNumber,
  cartItems,
  shippingForm,
  cartSubtotal,
  estimatedShipping,
  estimatedTax,
  currentStatus,
  trackingNumber,
  estimatedDeliveryDate,
  onBack,
  onContactSupport,
}: OrderStatusPageProps) {
  const currentStatusIndex = statusSteps.findIndex((s) => s.key === currentStatus)
  const total = cartSubtotal + estimatedShipping + estimatedTax

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Order Status</h1>
            <p className="mt-2 text-sm text-slate-400">Order #{orderNumber}</p>
          </div>
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
            onClick={onBack}
          >
            Back
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-8 lg:flex-row">
          {/* Main content */}
          <div className="flex-1 space-y-6">
            {/* Status timeline */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-6 text-lg font-semibold">Order Timeline</h2>
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 h-full w-0.5 bg-white/10" />
                
                {/* Status steps */}
                <div className="space-y-8">
                  {statusSteps.map((step, index) => {
                    const isCompleted = index <= currentStatusIndex
                    const isCurrent = index === currentStatusIndex

                    return (
                      <div key={step.key} className="relative flex items-start gap-4">
                        {/* Status dot */}
                        <div className="relative z-10 flex-shrink-0">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                              isCompleted
                                ? 'border-primary bg-primary'
                                : isCurrent
                                  ? 'border-primary bg-primary/20'
                                  : 'border-white/20 bg-surface'
                            }`}
                          >
                            {isCompleted ? (
                              <svg
                                className="h-5 w-5 text-white"
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
                            ) : isCurrent ? (
                              <div className="h-3 w-3 rounded-full bg-primary" />
                            ) : (
                              <div className="h-3 w-3 rounded-full bg-white/20" />
                            )}
                          </div>
                        </div>

                        {/* Status content */}
                        <div className="flex-1 pb-8">
                          <div
                            className={`${
                              isCompleted || isCurrent ? 'text-white' : 'text-slate-400'
                            }`}
                          >
                            <p
                              className={`text-base font-semibold ${
                                isCurrent ? 'text-primary' : ''
                              }`}
                            >
                              {step.label}
                            </p>
                            <p className="mt-1 text-sm">{step.description}</p>
                            {isCurrent && (
                              <p className="mt-2 text-xs text-slate-400">
                                {currentStatus === 'shipped' && trackingNumber
                                  ? `Tracking: ${trackingNumber}`
                                  : currentStatus === 'delivered'
                                    ? 'Delivered successfully'
                                    : 'In progress'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Tracking info */}
            {currentStatus === 'shipped' && trackingNumber && (
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-6">
                <h2 className="mb-2 text-lg font-semibold">Tracking Information</h2>
                <p className="text-sm text-slate-300">
                  <span className="font-medium">Tracking Number:</span> {trackingNumber}
                </p>
                {estimatedDeliveryDate && (
                  <p className="mt-2 text-sm text-slate-300">
                    <span className="font-medium">Estimated Delivery:</span>{' '}
                    {estimatedDeliveryDate}
                  </p>
                )}
                <button
                  className="mt-4 rounded-full border border-primary/60 px-4 py-2 text-sm font-semibold text-primary hover:border-primary"
                  onClick={() => {
                    // Open tracking in new window (placeholder)
                    window.open(`https://tracking.example.com/${trackingNumber}`, '_blank')
                  }}
                >
                  Track Package
                </button>
              </div>
            )}

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
              <h2 className="mb-4 text-lg font-semibold">Shipping Address</h2>
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
          </div>

          {/* Sidebar */}
          <div className="lg:w-80">
            <div className="sticky top-8 space-y-6">
              {/* Current status card */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="mb-4 text-lg font-semibold">Current Status</h2>
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-primary">
                    {statusSteps[currentStatusIndex]?.label}
                  </p>
                  <p className="text-sm text-slate-400">
                    {statusSteps[currentStatusIndex]?.description}
                  </p>
                </div>
              </div>

              {/* Help card */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="mb-4 text-lg font-semibold">Need Help?</h2>
                <div className="space-y-3 text-sm">
                  <p className="text-slate-300">
                    Questions about your order? We're here to help.
                  </p>
                  <button
                    className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
                    onClick={onContactSupport}
                  >
                    Contact Support
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

