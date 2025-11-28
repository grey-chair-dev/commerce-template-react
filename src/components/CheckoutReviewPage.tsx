import { useState } from 'react'
import type { Product } from '../dataAdapter'
import { moneyFormatter } from '../formatters'

export type CartItem = Product & { quantity: number }

type PaymentForm = {
  cardNumber: string
  expiryDate: string
  cvv: string
  cardholderName: string
}

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

type CheckoutReviewPageProps = {
  cartItems: CartItem[]
  shippingForm: ShippingForm
  paymentForm: PaymentForm
  cartSubtotal: number
  estimatedShipping: number
  estimatedTax: number
  onBack: () => void
  onComplete: () => void
  onCancel: () => void
}

export function CheckoutReviewPage({
  cartItems,
  shippingForm,
  paymentForm,
  cartSubtotal,
  estimatedShipping,
  estimatedTax,
  onBack,
  onComplete,
  onCancel,
}: CheckoutReviewPageProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const total = cartSubtotal + estimatedShipping + estimatedTax

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsProcessing(false)
    onComplete()
  }

  const steps = [
    { key: 'shipping', label: 'Shipping' },
    { key: 'payment', label: 'Payment' },
    { key: 'review', label: 'Review' },
  ]
  const currentStepIndex = 2

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8 sm:px-6 lg:px-8">
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
            {/* Shipping summary */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Shipping Information</h2>
                <button
                  className="text-sm text-primary hover:text-primary/80"
                  onClick={onBack}
                >
                  Edit
                </button>
              </div>
              <div className="mt-4 space-y-1 text-sm text-slate-300">
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

            {/* Payment summary */}
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
          </div>
        </div>
      </div>
    </div>
  )
}

