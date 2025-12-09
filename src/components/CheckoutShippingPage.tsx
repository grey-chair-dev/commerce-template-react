import { useState, useEffect } from 'react'
import { moneyFormatter } from '../formatters'
import type { User } from '@neondatabase/neon-auth'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Product } from '../dataAdapter'

type DeliveryMethod = 'delivery' | 'pickup'

type ContactForm = {
  email: string
  firstName: string
  lastName: string
  phone: string
  pickupLocation?: string
}

type CheckoutContactPageProps = {
  cartSubtotal: number
  estimatedTax: number
  user?: User | null
  isLoading?: boolean
  cartCount?: number
  wishlistCount?: number
  wishlistFeatureEnabled?: boolean
  products?: Product[]
  orderTrackingEnabled?: boolean
  onNext: (form: ContactForm) => void
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


const getInitialState = (user?: User | null): ContactForm => {
  return {
    email: user?.email || '',
    firstName: user?.user_metadata?.firstName || '',
    lastName: user?.user_metadata?.lastName || '',
    phone: user?.phone || user?.user_metadata?.phone || '',
  }
}

export function CheckoutContactPage({
  cartSubtotal,
  estimatedTax,
  user,
  isLoading = false,
  cartCount = 0,
  wishlistCount = 0,
  wishlistFeatureEnabled = false,
  products = [],
  orderTrackingEnabled = false,
  onNext,
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
}: CheckoutContactPageProps) {
  const [form, setForm] = useState<ContactForm>(getInitialState(user))

  // Fetch full customer details and update form when user is authenticated
  useEffect(() => {
    if (user && user.id) {
      // Fetch full customer details from API to get phone and other info
      (async () => {
        try {
          const { DataGateway } = await import('../services/DataGateway')
          const response = await DataGateway.getCurrentUser()
          
          if (response.error || !response.data) {
            // Fallback to user metadata if API call fails
            setForm((prev) => ({
              ...prev,
              email: user.email || prev.email || '',
              firstName: user.user_metadata?.firstName || prev.firstName || '',
              lastName: user.user_metadata?.lastName || prev.lastName || '',
              phone: user.phone || prev.phone || '',
            }))
            return
          }

          const userData = response.data
          // Prioritize API data - it has the most up-to-date information including phone
          setForm((prev) => ({
            ...prev,
            email: userData.email || prev.email || '',
            firstName: userData.user_metadata?.firstName || prev.firstName || '',
            lastName: userData.user_metadata?.lastName || prev.lastName || '',
            phone: userData.phone || prev.phone || user?.phone || '',
          }))
          console.log('[CheckoutContactPage] Pre-filled form with customer data:', {
            email: userData.email,
            firstName: userData.user_metadata?.firstName,
            lastName: userData.user_metadata?.lastName,
            phone: userData.phone,
          })
        } catch (error) {
          console.error('[CheckoutContactPage] Failed to fetch customer data:', error)
          // Fallback to user metadata on error
          setForm((prev) => ({
            ...prev,
            email: user.email || prev.email || '',
            firstName: user.user_metadata?.firstName || prev.firstName || '',
            lastName: user.user_metadata?.lastName || prev.lastName || '',
            phone: user.phone || prev.phone || '',
          }))
        }
      })()
    }
  }, [user])

  const updateField = (field: keyof ContactForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    
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
  }

  const total = cartSubtotal + estimatedTax

  const steps = [
    { key: 'contact', label: 'Contact' },
    { key: 'review', label: 'Review' },
  ]
  const currentStepIndex = 0

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
            <h1 className="text-3xl font-semibold">
              Contact Information
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              We need your contact info for pickup orders
            </p>
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

              {/* Pickup location info */}
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
                  Continue to Review
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

