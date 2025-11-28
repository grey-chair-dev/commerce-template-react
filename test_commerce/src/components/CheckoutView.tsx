import { useState } from 'react'
import type { Product } from '../dataAdapter'
import { moneyFormatter } from '../formatters'

export type CartItem = Product & { quantity: number }

type CheckoutViewProps = {
  cartItems: CartItem[]
  cartSubtotal: number
  estimatedShipping: number
  estimatedTax: number
  onClose: () => void
  onComplete: () => void
}

type CheckoutStep = 'shipping' | 'payment' | 'review'

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

type PaymentForm = {
  cardNumber: string
  expiryDate: string
  cvv: string
  cardholderName: string
}

const initialState: ShippingForm = {
  email: '',
  firstName: '',
  lastName: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  phone: '',
}

const initialPayment: PaymentForm = {
  cardNumber: '',
  expiryDate: '',
  cvv: '',
  cardholderName: '',
}

export function CheckoutView({
  cartItems,
  cartSubtotal,
  estimatedShipping,
  estimatedTax,
  onClose,
  onComplete,
}: CheckoutViewProps) {
  const [step, setStep] = useState<CheckoutStep>('shipping')
  const [shippingForm, setShippingForm] = useState<ShippingForm>(initialState)
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(initialPayment)
  const [isProcessing, setIsProcessing] = useState(false)

  const total = cartSubtotal + estimatedShipping + estimatedTax

  // Safety check: if cart is empty, close checkout
  if (cartItems.length === 0) {
    return null
  }

  const steps: { key: CheckoutStep; label: string }[] = [
    { key: 'shipping', label: 'Shipping' },
    { key: 'payment', label: 'Payment' },
    { key: 'review', label: 'Review' },
  ]

  const currentStepIndex = steps.findIndex((s) => s.key === step)

  const handleShippingNext = () => {
    // Basic validation
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingForm.email)
    if (
      emailValid &&
      shippingForm.firstName.trim() &&
      shippingForm.lastName.trim() &&
      shippingForm.address.trim() &&
      shippingForm.city.trim() &&
      shippingForm.state.trim() &&
      shippingForm.zipCode.trim()
    ) {
      setStep('payment')
    } else {
      // Show validation error (could be improved with state-based error messages)
      alert('Please fill in all required fields correctly.')
    }
  }

  const handlePaymentNext = () => {
    // Basic validation - check cleaned card number
    const cleanedCardNumber = paymentForm.cardNumber.replace(/\s/g, '')
    const cardNumberValid = cleanedCardNumber.length >= 13 && cleanedCardNumber.length <= 19
    const expiryValid = /^\d{2}\/\d{2}$/.test(paymentForm.expiryDate)
    const cvvValid = paymentForm.cvv.length >= 3 && paymentForm.cvv.length <= 4
    
    if (
      cardNumberValid &&
      expiryValid &&
      cvvValid &&
      paymentForm.cardholderName.trim()
    ) {
      setStep('review')
    } else {
      // Show validation error
      alert('Please fill in all payment fields correctly. Card number should be 13-19 digits, expiry MM/YY, CVV 3-4 digits.')
    }
  }

  const handleSubmit = async () => {
    setIsProcessing(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsProcessing(false)
    onComplete()
  }

  const updateShipping = (field: keyof ShippingForm, value: string) => {
    setShippingForm((prev) => ({ ...prev, [field]: value }))
  }

  const updatePayment = (field: keyof PaymentForm, value: string) => {
    setPaymentForm((prev) => ({ ...prev, [field]: value }))
  }

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '')
    const match = cleaned.match(/.{1,4}/g)
    return match ? match.join(' ') : cleaned
  }

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`
    }
    return cleaned
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex h-full w-full max-w-4xl flex-col bg-surface/95 text-white shadow-brand">
        {/* Header with progress */}
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Checkout</h2>
            <button
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:border-white/40"
              onClick={onClose}
            >
              Close
            </button>
          </div>
          {/* Progress bar */}
          <div className="mt-4 flex items-center gap-2">
            {steps.map((s, index) => (
              <div key={s.key} className="flex flex-1 items-center">
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
                    {s.label}
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 'shipping' && (
            <div className="mx-auto max-w-2xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Shipping Information</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Enter your delivery address. All fields are required.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Email address *
                  </label>
                  <input
                    type="email"
                    value={shippingForm.email}
                    onChange={(e) => updateShipping('email', e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      First name *
                    </label>
                    <input
                      type="text"
                      value={shippingForm.firstName}
                      onChange={(e) => updateShipping('firstName', e.target.value)}
                      placeholder="John"
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Last name *
                    </label>
                    <input
                      type="text"
                      value={shippingForm.lastName}
                      onChange={(e) => updateShipping('lastName', e.target.value)}
                      placeholder="Doe"
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Street address *
                  </label>
                  <input
                    type="text"
                    value={shippingForm.address}
                    onChange={(e) => updateShipping('address', e.target.value)}
                    placeholder="123 Main St"
                    className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-300">City *</label>
                    <input
                      type="text"
                      value={shippingForm.city}
                      onChange={(e) => updateShipping('city', e.target.value)}
                      placeholder="San Francisco"
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">State *</label>
                    <input
                      type="text"
                      value={shippingForm.state}
                      onChange={(e) => updateShipping('state', e.target.value)}
                      placeholder="CA"
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      ZIP code *
                    </label>
                    <input
                      type="text"
                      value={shippingForm.zipCode}
                      onChange={(e) => updateShipping('zipCode', e.target.value)}
                      placeholder="94102"
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Phone number
                    </label>
                    <input
                      type="tel"
                      value={shippingForm.phone}
                      onChange={(e) => updateShipping('phone', e.target.value)}
                      placeholder="(415) 555-0123"
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                  onClick={handleShippingNext}
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {step === 'payment' && (
            <div className="mx-auto max-w-2xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Payment Information</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Secure payment processing. Your card details are encrypted.
                </p>
              </div>

              {/* Trust signals */}
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <span className="text-xs text-slate-400">Secured by</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  SSL
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  Visa
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  Mastercard
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Cardholder name *
                  </label>
                  <input
                    type="text"
                    value={paymentForm.cardholderName}
                    onChange={(e) => updatePayment('cardholderName', e.target.value)}
                    placeholder="John Doe"
                    className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Card number *
                  </label>
                  <input
                    type="text"
                    value={paymentForm.cardNumber}
                    onChange={(e) =>
                      updatePayment('cardNumber', formatCardNumber(e.target.value))
                    }
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Expiry date *
                    </label>
                    <input
                      type="text"
                      value={paymentForm.expiryDate}
                      onChange={(e) => updatePayment('expiryDate', formatExpiry(e.target.value))}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">CVV *</label>
                    <input
                      type="text"
                      value={paymentForm.cvv}
                      onChange={(e) => updatePayment('cvv', e.target.value.replace(/\D/g, ''))}
                      placeholder="123"
                      maxLength={4}
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                  onClick={() => setStep('shipping')}
                >
                  Back
                </button>
                <button
                  className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                  onClick={handlePaymentNext}
                >
                  Review Order
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="mx-auto max-w-2xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Review Your Order</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Please review your information before completing your purchase.
                </p>
              </div>

              {/* Shipping summary */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h4 className="mb-3 text-sm font-semibold text-white">Shipping to</h4>
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
                <button
                  className="mt-3 text-xs text-primary hover:text-primary/80"
                  onClick={() => setStep('shipping')}
                >
                  Edit
                </button>
              </div>

              {/* Payment summary */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h4 className="mb-3 text-sm font-semibold text-white">Payment method</h4>
                <div className="space-y-1 text-sm text-slate-300">
                  <p>{paymentForm.cardholderName}</p>
                  <p>
                    •••• •••• •••• {paymentForm.cardNumber.replace(/\s/g, '').slice(-4) || '****'}
                  </p>
                  <p>Expires {paymentForm.expiryDate}</p>
                </div>
                <button
                  className="mt-3 text-xs text-primary hover:text-primary/80"
                  onClick={() => setStep('payment')}
                >
                  Edit
                </button>
              </div>

              {/* Order summary */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h4 className="mb-3 text-sm font-semibold text-white">Order summary</h4>
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-12 w-12 rounded-lg object-cover"
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

              <div className="flex gap-3 pt-4">
                <button
                  className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                  onClick={() => setStep('payment')}
                >
                  Back
                </button>
                <button
                  className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : `Complete Order • ${moneyFormatter.format(total)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

