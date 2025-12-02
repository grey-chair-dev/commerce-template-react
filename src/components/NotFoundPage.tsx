import { siteConfig } from '../config'
import type { Product } from '../dataAdapter'
import { Header } from './Header'
import { Footer } from './Footer'

type NotFoundPageProps = {
  user: any
  isLoading: boolean
  cartCount: number
  wishlistCount: number
  wishlistFeatureEnabled: boolean
  products: Product[]
  orderTrackingEnabled: boolean
  onProductSelect: (product: Product) => void
  onSearch: () => void
  onSignIn: () => void
  onSignOut: () => void
  onAccount: () => void
  onCart: () => void
  onWishlist: () => void
  onTrackOrder: () => void
  onContactUs: () => void
  onShippingReturns?: () => void
  onPrivacyPolicy?: () => void
  onTermsOfService?: () => void
}

export function NotFoundPage({
  user,
  isLoading,
  cartCount,
  wishlistCount,
  wishlistFeatureEnabled,
  products,
  orderTrackingEnabled,
  onProductSelect,
  onSearch,
  onSignIn,
  onSignOut,
  onAccount,
  onCart,
  onWishlist,
  onTrackOrder,
  onContactUs,
  onShippingReturns,
  onPrivacyPolicy,
  onTermsOfService,
}: NotFoundPageProps) {
  // Get top 3 categories for suggestions
  const categories = Array.from(new Set(products.map((p) => p.category))).slice(0, 3)

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
        <div className="max-w-2xl space-y-8">
        {/* 404 Heading */}
        <div className="space-y-4">
          <h1 className="text-8xl font-bold text-primary">404</h1>
          <h2 className="text-3xl font-semibold text-white">Oops! Page Not Found</h2>
          <p className="text-lg text-slate-300">
            We're sorry, but the page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Search Bar */}
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Try searching for what you need:</p>
          <button
            onClick={onSearch}
            className="mx-auto flex w-full max-w-md items-center justify-between rounded-full border border-white/20 bg-white/5 px-6 py-3 text-left text-white placeholder-slate-500 hover:border-white/40 focus:border-primary focus:outline-none"
          >
            <span className="text-slate-400">Search products...</span>
            <svg
              className="h-5 w-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>

        {/* Popular Categories */}
        {categories.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Or browse our popular categories:</p>
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 hover:border-white/40"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Helpful Links */}
        <div className="space-y-4 pt-8">
          <p className="text-sm text-slate-400">You might also find these helpful:</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/"
              className="rounded-full border border-white/20 bg-primary/20 px-6 py-2 text-sm font-semibold text-primary hover:bg-primary/30"
            >
              Go to Homepage
            </a>
            <button
              onClick={onSearch}
              className="rounded-full border border-white/20 bg-white/5 px-6 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
            >
              Browse All Products
            </button>
          </div>
        </div>

        {/* Contact Support */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="mb-2 text-sm font-semibold text-white">Still can't find what you're looking for?</p>
          <p className="mb-4 text-xs text-slate-300">
            Our team is here to help. Contact us and we'll get you back on track.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs text-white/80 hover:border-white/40"
            >
              Email Us
            </a>
            <a
              href={`tel:${siteConfig.contact.phone}`}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs text-white/80 hover:border-white/40"
            >
              Call Us
            </a>
          </div>
        </div>
        </div>
      </main>

      <Footer
        orderTrackingEnabled={orderTrackingEnabled}
        onTrackOrder={onTrackOrder}
        onContactUs={onContactUs}
        onShippingReturns={onShippingReturns}
        onPrivacyPolicy={onPrivacyPolicy}
        onTermsOfService={onTermsOfService}
      />
    </div>
  )
}

