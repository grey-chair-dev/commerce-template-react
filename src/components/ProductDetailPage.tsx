import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Product } from '../dataAdapter'
import { moneyFormatter } from '../formatters'
import { Header } from './Header'
import { Footer } from './Footer'

type ProductDetailPageProps = {
  product: Product | null
  products: Product[]
  user: any
  isLoading: boolean
  cartCount: number
  wishlistCount: number
  wishlistFeatureEnabled: boolean
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
  onAddToCart: (product: Product, quantity?: number) => void
  onToggleWishlist?: (product: Product) => void
}

const galleryFallbacks = [
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=800&q=80',
]

const enableSpecifications =
  (import.meta.env.VITE_ENABLE_PRODUCT_SPECIFICATIONS ?? 'true').toString().toLowerCase() !== 'false'

const enableReviews =
  (import.meta.env.VITE_ENABLE_PRODUCT_REVIEWS ?? 'true').toString().toLowerCase() !== 'false'

export function ProductDetailPage({
  product: productProp,
  products,
  user,
  isLoading,
  cartCount,
  wishlistCount,
  wishlistFeatureEnabled,
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
  onAddToCart,
  onToggleWishlist,
}: ProductDetailPageProps) {
  const navigate = useNavigate()
  const { productId } = useParams<{ productId: string }>()
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [activeTab, setActiveTab] = useState<'description' | 'specifications' | 'reviews'>('description')
  
  // Use product from prop or find by ID
  const product = productProp || (productId ? products.find((p) => p.id === productId) : null)
  
  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-white">Product not found</p>
          <button onClick={() => navigate('/catalog')} className="mt-4 text-primary">
            Back to catalog
          </button>
        </div>
      </div>
    )
  }
  
  const gallery = buildGallery(product)
  const isOnSale = product.stockCount <= 10
  const isSaved = wishlistFeatureEnabled && onToggleWishlist
    ? useMemo(() => {
        try {
          const stored = localStorage.getItem('wishlist')
          const wishlist = stored ? JSON.parse(stored) : []
          return wishlist.some((item: Product) => item.id === product.id)
        } catch {
          return false
        }
      }, [product.id])
    : false

  const handleAddToCart = () => {
    onAddToCart(product, quantity)
  }

  // Mock specifications data
  const specifications = [
    { label: 'Material', value: 'Premium Quality' },
    { label: 'Dimensions', value: 'Standard Size' },
    { label: 'Weight', value: 'Lightweight' },
    { label: 'Care Instructions', value: 'Hand wash recommended' },
    { label: 'Origin', value: 'Locally sourced' },
  ]

  // Mock reviews data
  const reviews = [
    {
      id: '1',
      author: 'Sarah M.',
      rating: 5,
      date: '2024-11-15',
      comment: 'Absolutely love this product! Great quality and fast shipping.',
    },
    {
      id: '2',
      author: 'John D.',
      rating: 4,
      date: '2024-11-10',
      comment: 'Very satisfied with my purchase. Would recommend to others.',
    },
    {
      id: '3',
      author: 'Emily R.',
      rating: 5,
      date: '2024-11-05',
      comment: 'Exceeded my expectations. The product is exactly as described.',
    },
  ]

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

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pt-40 pb-6 text-text sm:gap-8 sm:px-6 sm:pt-48 sm:pb-10 md:pt-56 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition self-start min-h-[44px]"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Product Header Section */}
        <div className="grid gap-8 lg:grid-cols-[1.5fr,1fr] lg:gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 aspect-square">
              <img
                src={gallery[selectedImage]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
              {isOnSale && (
                <div className="absolute left-4 top-4 rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-white">
                  Sale
                </div>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:gap-3">
              {gallery.map((image, index) => (
                <button
                  key={image + index}
                  onClick={() => setSelectedImage(index)}
                  className={`flex-shrink-0 overflow-hidden rounded-xl border-2 transition min-h-[60px] min-w-[60px] sm:rounded-2xl sm:min-h-[80px] sm:min-w-[80px] ${
                    selectedImage === index
                      ? 'border-primary scale-105'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <img
                    src={image}
                    alt={`${product.name} view ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info & Purchase */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                {isOnSale && (
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-white">
                    Limited Stock
                  </span>
                )}
                <span className="text-xs uppercase tracking-[0.3em] text-secondary">
                  {product.category}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight mb-3 sm:text-3xl lg:text-4xl">{product.name}</h1>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <StarRating rating={product.rating} />
                  <span className="text-slate-300">
                    {product.rating.toFixed(1)} ({product.reviewCount} reviews)
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:rounded-3xl sm:p-6">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-2xl font-bold text-white sm:text-3xl">
                  {moneyFormatter.format(product.price)}
                </span>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Secure checkout
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:rounded-2xl sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">Availability</span>
                    <span
                      className={`text-sm font-semibold ${
                        product.stockCount > 0
                          ? product.stockCount <= 5
                            ? 'text-secondary'
                            : 'text-accent'
                          : 'text-slate-400'
                      }`}
                    >
                      {product.stockCount > 0
                        ? `${product.stockCount} ${product.stockCount === 1 ? 'unit' : 'units'} in stock`
                        : 'Out of stock'}
                    </span>
                  </div>
                  {product.stockCount > 0 && (
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          product.stockCount <= 5 ? 'bg-secondary' : 'bg-accent'
                        }`}
                        style={{
                          width: `${Math.min(100, (product.stockCount / 50) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {product.stockCount > 0 && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <label className="text-sm font-semibold text-white">Quantity:</label>
                    <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-4 py-3 text-white/80 hover:text-white transition min-h-[44px] min-w-[44px]"
                        disabled={quantity <= 1}
                      >
                        −
                      </button>
                      <span className="px-4 py-3 text-white font-semibold min-w-[3rem] text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity((q) => Math.min(product.stockCount, q + 1))}
                        className="px-4 py-3 text-white/80 hover:text-white transition min-h-[44px] min-w-[44px]"
                        disabled={quantity >= product.stockCount}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  {product.stockCount > 0 ? (
                    <>
                      <button
                        className="w-full rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-brand hover:bg-primary/80 transition min-h-[44px] sm:py-4 sm:text-base"
                        onClick={handleAddToCart}
                      >
                        Add {quantity > 1 ? `${quantity} to` : 'to'} cart
                      </button>
                      {onToggleWishlist && (
                        <button
                          className={`w-full rounded-full border-2 px-6 py-3.5 text-sm font-semibold transition min-h-[44px] sm:py-4 sm:text-base ${
                            isSaved
                              ? 'border-secondary bg-secondary/20 text-secondary'
                              : 'border-white/20 text-white/80 hover:border-white/40 hover:text-white'
                          }`}
                          onClick={() => onToggleWishlist(product)}
                        >
                          {isSaved ? 'Saved to wishlist' : 'Save to wishlist'}
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      className="w-full rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold text-white/50 cursor-not-allowed min-h-[44px] sm:py-4 sm:text-base"
                      disabled
                    >
                      Out of stock
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-4 text-xs sm:gap-3">
                  <span className="rounded-full bg-white/10 px-2.5 py-1.5 text-white/80 sm:px-3">
                    Free returns
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1.5 text-white/80 sm:px-3">
                    Secure checkout
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1.5 text-white/80 sm:px-3">
                    Fast shipping
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="space-y-4 sm:space-y-6">
          {/* Tab Navigation */}
          <div className="flex gap-1 overflow-x-auto border-b border-white/10 sm:gap-2 scrollbar-hide">
            <button
              onClick={() => setActiveTab('description')}
              className={`px-4 py-3 text-xs font-semibold transition border-b-2 whitespace-nowrap min-h-[44px] sm:px-6 sm:text-sm ${
                activeTab === 'description'
                  ? 'border-primary text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Description
            </button>
            {enableSpecifications && (
              <button
                onClick={() => setActiveTab('specifications')}
                className={`px-4 py-3 text-xs font-semibold transition border-b-2 whitespace-nowrap min-h-[44px] sm:px-6 sm:text-sm ${
                  activeTab === 'specifications'
                    ? 'border-primary text-white'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Specifications
              </button>
            )}
            {enableReviews && (
              <button
                onClick={() => setActiveTab('reviews')}
                className={`px-4 py-3 text-xs font-semibold transition border-b-2 whitespace-nowrap min-h-[44px] sm:px-6 sm:text-sm ${
                  activeTab === 'reviews'
                    ? 'border-primary text-white'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Reviews ({product.reviewCount})
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px] sm:min-h-[400px]">
            {activeTab === 'description' && (
              <div className="space-y-3 sm:space-y-4">
                <h2 className="text-xl font-semibold text-white sm:text-2xl">Product Description</h2>
                <p className="text-base text-slate-200 leading-relaxed sm:text-lg">{product.description}</p>
              </div>
            )}

            {activeTab === 'specifications' && enableSpecifications && (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-white">Specifications</h2>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <dl className="space-y-4">
                    {specifications.map((spec, index) => (
                      <div key={index} className="flex justify-between items-start border-b border-white/10 pb-4 last:border-0 last:pb-0">
                        <dt className="text-sm font-semibold text-white">{spec.label}</dt>
                        <dd className="text-sm text-slate-300 text-right">{spec.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && enableReviews && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-white">
                    Customer Reviews ({reviews.length})
                  </h2>
                  <div className="flex items-center gap-2">
                    <StarRating rating={product.rating} />
                    <span className="text-lg font-semibold text-white">{product.rating.toFixed(1)}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-6"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-white">{review.author}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <StarRating rating={review.rating} />
                            <span className="text-xs text-slate-400">{review.date}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-200 leading-relaxed">{review.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = rating >= index + 1
        return (
          <span key={index} className="text-lg text-accent">
            {filled ? '★' : '☆'}
          </span>
        )
      })}
    </div>
  )
}

function buildGallery(product: Product): string[] {
  const base = sanitizeGallerySource(product.imageUrl)
  const extras = galleryFallbacks.map((url) => sanitizeGallerySource(url))
  return [base, ...extras]
}

function sanitizeGallerySource(url: string): string {
  if (!url) {
    return galleryFallbacks[0]
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  return galleryFallbacks[0]
}
