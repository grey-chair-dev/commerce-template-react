import { useNavigate } from 'react-router-dom'
import { siteConfig } from '../config'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Product } from '../dataAdapter'

type ShippingReturnsPageProps = {
  user: any
  isLoading: boolean
  cartCount: number
  wishlistCount: number
  wishlistFeatureEnabled: boolean
  products: Product[]
  orderTrackingEnabled: boolean
  onSignIn: () => void
  onSignOut: () => void
  onAccount: () => void
  onCart: () => void
  onWishlist: () => void
  onSearch: () => void
  onProductSelect: (product: Product) => void
  onTrackOrder: () => void
  onAboutUs?: () => void
  onContactUs?: () => void
  onPrivacyPolicy?: () => void
  onTermsOfService?: () => void
}

const checkoutMode = (import.meta.env.VITE_CHECKOUT_MODE ?? 'both').toString().toLowerCase()
const isPickupOnly = checkoutMode === 'pickup'
const showShipping = !isPickupOnly

export function ShippingReturnsPage({
  user,
  isLoading,
  cartCount,
  wishlistCount,
  wishlistFeatureEnabled,
  products,
  orderTrackingEnabled,
  onSignIn,
  onSignOut,
  onAccount,
  onCart,
  onWishlist,
  onSearch,
  onProductSelect,
  onTrackOrder,
  onAboutUs,
  onContactUs,
  onPrivacyPolicy,
  onTermsOfService,
}: ShippingReturnsPageProps) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col">
      <Header
        user={user}
        isLoading={isLoading}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        wishlistFeatureEnabled={wishlistFeatureEnabled}
        products={products}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        onAccount={onAccount}
        onCart={onCart}
        onWishlist={onWishlist}
        onSearch={onSearch}
        onProductSelect={onProductSelect}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-4 pt-32 pb-6 text-text sm:gap-8 sm:px-6 sm:pt-44 sm:pb-10 md:pt-56 lg:pt-60 lg:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold">
                {isPickupOnly ? 'Returns Policy' : 'Shipping & Returns'}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {isPickupOnly
                  ? 'Everything you need to know about returns'
                  : 'Everything you need to know about shipping and returns'}
              </p>
            </div>
            <button
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
              onClick={() => navigate('/')}
            >
              Close
            </button>
          </div>

        <div className="flex flex-1 flex-col gap-8">
          {/* Shipping Section - Only show if not pickup-only */}
          {showShipping && (
            <section className="space-y-6">
              <h2 className="text-2xl font-semibold">Shipping Information</h2>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="mb-4 text-lg font-semibold">Shipping Options</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-white">Standard Shipping</p>
                    <p className="mt-1 text-sm text-slate-300">
                      5-7 business days · Free on orders over $50
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-white">Express Shipping</p>
                    <p className="mt-1 text-sm text-slate-300">
                      2-3 business days · $9.99
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-white">Local Pickup</p>
                    <p className="mt-1 text-sm text-slate-300">
                      Available at {siteConfig.contact.location} · Free
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="mb-4 text-lg font-semibold">Shipping Timeline</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <p className="text-sm text-slate-300">
                    <span className="font-semibold text-white">Order Placed:</span> We receive your
                    order immediately
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <p className="text-sm text-slate-300">
                    <span className="font-semibold text-white">Processing:</span> 1-2 business days
                    to prepare your order
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <p className="text-sm text-slate-300">
                    <span className="font-semibold text-white">Shipped:</span> You'll receive a
                    tracking number via email
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <p className="text-sm text-slate-300">
                    <span className="font-semibold text-white">Delivered:</span> Estimated delivery
                    based on your shipping method
                  </p>
                </div>
              </div>
            </div>
            </section>
          )}

          {/* Returns Section */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Returns & Exchanges</h2>

            {/* Returns Flowchart */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="mb-6 text-lg font-semibold">Return Process</h3>
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">Initiate Return</p>
                    <p className="mt-1 text-sm text-slate-300">
                      Contact us within 30 days of delivery to start a return. Include your order
                      number and reason for return.
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="ml-5 flex items-center">
                  <div className="h-8 w-0.5 bg-accent/30" />
                  <div className="h-0.5 w-8 bg-accent/30" />
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">Receive Return Authorization</p>
                    <p className="mt-1 text-sm text-slate-300">
                      We'll email you a return authorization and prepaid shipping label (if
                      applicable).
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="ml-5 flex items-center">
                  <div className="h-8 w-0.5 bg-accent/30" />
                  <div className="h-0.5 w-8 bg-accent/30" />
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">Package & Ship</p>
                    <p className="mt-1 text-sm text-slate-300">
                      Package items in original packaging with tags attached. Use the provided
                      shipping label and drop off at any carrier location.
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="ml-5 flex items-center">
                  <div className="h-8 w-0.5 bg-accent/30" />
                  <div className="h-0.5 w-8 bg-accent/30" />
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">
                    4
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">Refund Processed</p>
                    <p className="mt-1 text-sm text-slate-300">
                      Once we receive and inspect your return (5-7 business days), we'll process
                      your refund to the original payment method within 3-5 business days.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Return Policy Details */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="mb-3 text-lg font-semibold">Return Eligibility</h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                    <span>Items must be unused and in original packaging</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                    <span>All tags and labels must be attached</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                    <span>Return must be initiated within 30 days</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                    <span>Original receipt or order confirmation required</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="mb-3 text-lg font-semibold">Non-Returnable Items</h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-secondary">✗</span>
                    <span>Personalized or custom-made items</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-secondary">✗</span>
                    <span>Items damaged by misuse or wear</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-secondary">✗</span>
                    <span>Final sale items (clearly marked)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-secondary">✗</span>
                    <span>Gift cards and digital products</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Exchange Process */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="mb-4 text-lg font-semibold">Exchanges</h3>
              <p className="mb-4 text-sm text-slate-300">
                We offer exchanges for different sizes or colors. Follow the same return process
                above, and specify in your return request that you'd like an exchange. We'll send
                the new item once we receive your return.
              </p>
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                <p className="text-sm text-white">
                  <span className="font-semibold">Tip:</span> Exchanges are processed faster if
                  the item you want is in stock. Check availability before initiating an exchange.
                </p>
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-4 text-lg font-semibold">Need Help?</h3>
            <p className="mb-4 text-sm text-slate-300">
              Questions about shipping or returns? Our team is here to help.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
              >
                Email Us
              </a>
              <a
                href={`tel:${siteConfig.contact.phone}`}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
              >
                Call Us
              </a>
            </div>
          </section>
        </div>
      </main>

      <Footer
        orderTrackingEnabled={orderTrackingEnabled}
        onTrackOrder={onTrackOrder}
        onContactUs={onContactUs || (() => {})}
        onAboutUs={onAboutUs || (() => {})}
        onShippingReturns={() => navigate('/shipping-returns')}
        onPrivacyPolicy={onPrivacyPolicy || (() => {})}
        onTermsOfService={onTermsOfService || (() => {})}
      />
    </div>
  )
}

