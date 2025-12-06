import { Header } from './Header'
import { Footer } from './Footer'

type EditorialPageProps = {
  user: any
  isLoading: boolean
  cartCount: number
  wishlistCount: number
  wishlistFeatureEnabled: boolean
  products: any[]
  orderTrackingEnabled: boolean
  onSignIn: () => void
  onSignOut: () => void
  onAccount: () => void
  onCart: () => void
  onWishlist: () => void
  onSearch: () => void
  onProductSelect: (product: any) => void
  onTrackOrder: () => void
  onContactUs: () => void
  onAboutUs: () => void
  onShippingReturns: () => void
  onPrivacyPolicy: () => void
  onTermsOfService: () => void
}

export function EditorialPage({
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
  onContactUs,
  onAboutUs,
  onShippingReturns,
  onPrivacyPolicy,
  onTermsOfService,
}: EditorialPageProps) {
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

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-4 pt-32 pb-10 text-text sm:px-6 sm:pt-44 md:pt-56 lg:pt-60 lg:px-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl">Editorial</h1>
            <p className="mt-4 text-lg text-slate-300">
              Stories, reviews, and features from the world of vinyl
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-slate-300">Editorial content coming soon</p>
            <p className="mt-2 text-sm text-slate-400">
              Check back for album reviews, artist features, and music culture stories
            </p>
          </div>
        </div>
      </main>

      <Footer
        orderTrackingEnabled={orderTrackingEnabled}
        onTrackOrder={onTrackOrder}
        onContactUs={onContactUs}
        onAboutUs={onAboutUs}
        onShippingReturns={onShippingReturns}
        onPrivacyPolicy={onPrivacyPolicy}
        onTermsOfService={onTermsOfService}
      />
    </div>
  )
}

