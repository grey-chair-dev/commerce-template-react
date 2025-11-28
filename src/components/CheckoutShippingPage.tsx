import { useState } from 'react'
import { moneyFormatter } from '../formatters'

type DeliveryMethod = 'delivery' | 'pickup'

type ShippingForm = {
  deliveryMethod?: DeliveryMethod
  email: string
  firstName: string
  lastName: string
  address: string
  city: string
  state: string
  zipCode: string
  phone: string
  pickupLocation?: string
}

type CheckoutShippingPageProps = {
  cartSubtotal: number
  estimatedShipping: number
  estimatedTax: number
  onNext: (form: ShippingForm) => void
  onCancel: () => void
}

const checkoutMode =
  (import.meta.env.VITE_CHECKOUT_MODE ?? 'both').toString().toLowerCase()
const isDeliveryOnly = checkoutMode === 'delivery'
const isPickupOnly = checkoutMode === 'pickup'
const isBoth = checkoutMode === 'both' || (!isDeliveryOnly && !isPickupOnly)

const getInitialState = (): ShippingForm => {
  const base = {
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
  }
  
  if (isBoth) {
    return { ...base, deliveryMethod: 'delivery' }
  }
  if (isPickupOnly) {
    return { ...base, deliveryMethod: 'pickup' }
  }
  return base
}

export function CheckoutShippingPage({
  cartSubtotal,
  estimatedShipping,
  estimatedTax,
  onNext,
  onCancel,
}: CheckoutShippingPageProps) {
  const [form, setForm] = useState<ShippingForm>(getInitialState())

  const updateField = (field: keyof ShippingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    
    // Validation based on delivery method
    if (isPickupOnly || form.deliveryMethod === 'pickup') {
      // Pickup: only need email, name, and phone
      if (
        emailValid &&
        form.firstName.trim() &&
        form.lastName.trim() &&
        form.phone.trim()
      ) {
        onNext(form)
      } else {
        alert('Please fill in all required fields correctly.')
      }
    } else {
      // Delivery: need full address
      if (
        emailValid &&
        form.firstName.trim() &&
        form.lastName.trim() &&
        form.address.trim() &&
        form.city.trim() &&
        form.state.trim() &&
        form.zipCode.trim()
      ) {
        onNext(form)
      } else {
        alert('Please fill in all required fields correctly.')
      }
    }
  }

  const total = cartSubtotal + estimatedShipping + estimatedTax

  const steps = [
    { key: 'shipping', label: 'Shipping' },
    { key: 'payment', label: 'Payment' },
    { key: 'review', label: 'Review' },
  ]
  const currentStepIndex = 0

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Shipping Information</h1>
            <p className="mt-2 text-sm text-slate-400">Step 1 of 3</p>
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
              {/* Delivery method selection (only if both modes available) */}
              {isBoth && (
                <div>
                  <label className="mb-3 block text-sm font-medium text-slate-300">
                    Delivery Method *
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, deliveryMethod: 'delivery' }))}
                      className={`rounded-2xl border p-4 text-left transition ${
                        form.deliveryMethod === 'delivery'
                          ? 'border-primary bg-primary/20'
                          : 'border-white/20 bg-white/5 hover:border-white/40'
                      }`}
                    >
                      <p className="font-semibold text-white">Delivery</p>
                      <p className="mt-1 text-xs text-slate-400">
                        We'll deliver to your address
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, deliveryMethod: 'pickup' }))}
                      className={`rounded-2xl border p-4 text-left transition ${
                        form.deliveryMethod === 'pickup'
                          ? 'border-primary bg-primary/20'
                          : 'border-white/20 bg-white/5 hover:border-white/40'
                      }`}
                    >
                      <p className="font-semibold text-white">Pickup</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Pick up at our location
                      </p>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Email address *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
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
                    value={form.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
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
                    value={form.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    placeholder="Doe"
                    className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Delivery address fields (only for delivery) */}
              {(isDeliveryOnly || form.deliveryMethod === 'delivery') && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Street address *
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="123 Main St"
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      required={isDeliveryOnly || form.deliveryMethod === 'delivery'}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-300">City *</label>
                      <input
                        type="text"
                        value={form.city}
                        onChange={(e) => updateField('city', e.target.value)}
                        placeholder="San Francisco"
                        className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                        required={isDeliveryOnly || form.deliveryMethod === 'delivery'}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">State *</label>
                      <input
                        type="text"
                        value={form.state}
                        onChange={(e) => updateField('state', e.target.value)}
                        placeholder="CA"
                        className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                        required={isDeliveryOnly || form.deliveryMethod === 'delivery'}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      ZIP code *
                    </label>
                    <input
                      type="text"
                      value={form.zipCode}
                      onChange={(e) => updateField('zipCode', e.target.value)}
                      placeholder="94102"
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      required={isDeliveryOnly || form.deliveryMethod === 'delivery'}
                    />
                  </div>
                </>
              )}

              {/* Pickup location info (only for pickup) */}
              {(isPickupOnly || form.deliveryMethod === 'pickup') && (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                  <p className="text-sm font-semibold text-white">Pickup Location</p>
                  <p className="mt-1 text-sm text-slate-300">
                    118 Grove St, San Francisco, CA 94102
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Hours: Open daily · 8a – 8p
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    We'll notify you when your order is ready for pickup.
                  </p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Phone number *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="(415) 555-0123"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                  onClick={onCancel}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                >
                  Continue to Payment
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

