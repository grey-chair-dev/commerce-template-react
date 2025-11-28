import { Layout } from '../components/Layout'
import type { Product } from '../dataAdapter'

type RouteWrapperProps = {
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
  onContactUs: () => void
  onAboutUs: () => void
  onShippingReturns: () => void
  onPrivacyPolicy: () => void
  onTermsOfService: () => void
  children: React.ReactNode
}

export function RouteWrapper({
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
  children,
}: RouteWrapperProps) {
  return (
    <Layout
      user={user}
      isLoading={isLoading}
      cartCount={cartCount}
      wishlistCount={wishlistCount}
      wishlistFeatureEnabled={wishlistFeatureEnabled}
      products={products}
      orderTrackingEnabled={orderTrackingEnabled}
      onSignIn={onSignIn}
      onSignOut={onSignOut}
      onAccount={onAccount}
      onCart={onCart}
      onWishlist={onWishlist}
      onSearch={onSearch}
      onProductSelect={onProductSelect}
      onTrackOrder={onTrackOrder}
      onContactUs={onContactUs}
      onAboutUs={onAboutUs}
      onShippingReturns={onShippingReturns}
      onPrivacyPolicy={onPrivacyPolicy}
      onTermsOfService={onTermsOfService}
    >
      {children}
    </Layout>
  )
}

