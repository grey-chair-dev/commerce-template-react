import { useState } from 'react'
import { moneyFormatter } from '../formatters'

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
  deliveryMethod?: 'delivery' | 'pickup'
}

type CheckoutPaymentPageProps = {
  shippingForm: ShippingForm
  cartSubtotal: number
  estimatedShipping: number
  estimatedTax: number
  onNext: (form: PaymentForm) => void
  onBack: () => void
  onCancel: () => void
}

const initialPayment: PaymentForm = {
  cardNumber: '',
  expiryDate: '',
  cvv: '',
  cardholderName: '',
}

export function CheckoutPaymentPage({
  shippingForm,
  cartSubtotal,
  estimatedShipping,
  estimatedTax,
  onNext,
  onBack,
  onCancel,
}: CheckoutPaymentPageProps) {
  const [form, setForm] = useState<PaymentForm>(initialPayment)

  const updateField = (field: keyof PaymentForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanedCardNumber = form.cardNumber.replace(/\s/g, '')
    const cardNumberValid = cleanedCardNumber.length >= 13 && cleanedCardNumber.length <= 19
    const expiryValid = /^\d{2}\/\d{2}$/.test(form.expiryDate)
    const cvvValid = form.cvv.length >= 3 && form.cvv.length <= 4

    if (cardNumberValid && expiryValid && cvvValid && form.cardholderName.trim()) {
      onNext(form)
    } else {
      alert('Please fill in all payment fields correctly. Card number should be 13-19 digits, expiry MM/YY, CVV 3-4 digits.')
    }
  }

  const total = cartSubtotal + estimatedShipping + estimatedTax

  const steps = [
    { key: 'shipping', label: 'Shipping' },
    { key: 'payment', label: 'Payment' },
    { key: 'review', label: 'Review' },
  ]
  const currentStepIndex = 1

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Payment Information</h1>
            <p className="mt-2 text-sm text-slate-400">Step 2 of 3</p>
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
          {/* Main form */}
          <div className="flex-1">
            <form onSubmit={handleSubmit} className="space-y-6">
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

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Cardholder name *
                </label>
                <input
                  type="text"
                  value={form.cardholderName}
                  onChange={(e) => updateField('cardholderName', e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Card number *</label>
                <input
                  type="text"
                  value={form.cardNumber}
                  onChange={(e) => updateField('cardNumber', formatCardNumber(e.target.value))}
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
                    value={form.expiryDate}
                    onChange={(e) => updateField('expiryDate', formatExpiry(e.target.value))}
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
                    value={form.cvv}
                    onChange={(e) => updateField('cvv', e.target.value.replace(/\D/g, ''))}
                    placeholder="123"
                    maxLength={4}
                    className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

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
                  className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                >
                  Review Order
                </button>
              </div>
            </form>
          </div>

          {/* Order summary sidebar */}
          <div className="lg:w-80">
            <div className="sticky top-8 rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
              <div className="mb-4 space-y-1 border-b border-white/10 pb-4 text-sm text-slate-300">
                <p className="font-medium text-white">
                  {shippingForm.deliveryMethod === 'pickup' ? 'Pickup Information:' : 'Shipping to:'}
                </p>
                <p>
                  {shippingForm.firstName} {shippingForm.lastName}
                </p>
                {shippingForm.deliveryMethod === 'delivery' ? (
                  <>
                    <p>{shippingForm.address}</p>
                    <p>
                      {shippingForm.city}, {shippingForm.state} {shippingForm.zipCode}
                    </p>
                  </>
                ) : (
                  <p className="text-primary">Store pickup</p>
                )}
                {shippingForm.phone && <p>{shippingForm.phone}</p>}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal</span>
                  <span>{moneyFormatter.format(cartSubtotal)}</span>
                </div>
                {shippingForm.deliveryMethod !== 'pickup' && (
                  <div className="flex justify-between text-slate-300">
                    <span>Shipping</span>
                    <span>{moneyFormatter.format(estimatedShipping)}</span>
                  </div>
                )}
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

