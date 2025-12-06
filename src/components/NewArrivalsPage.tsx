import { useMemo, useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Product } from '../dataAdapter'
import { moneyFormatter } from '../formatters'
import { Header } from './Header'
import { Footer } from './Footer'

type NewArrivalsPageProps = {
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
  onQuickView: (product: Product) => void
  onViewDetails: (product: Product) => void
  onToggleWishlist: (product: Product) => void
  onAddToCart: (product: Product) => void
}

const BATCH_SIZE = 12

export function NewArrivalsPage({
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
  onQuickView,
  onViewDetails,
  onToggleWishlist,
  onAddToCart,
}: NewArrivalsPageProps) {
  const navigate = useNavigate()
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const infiniteSentinelRef = useRef<HTMLDivElement>(null)
  const [currentProductIndex, setCurrentProductIndex] = useState(0)
  const [showArrows, setShowArrows] = useState(false)
  const arrowTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // New Arrivals - products sorted by stock count (higher stock = newer)
  const newArrivals = useMemo(() => {
    return [...products]
      .sort((a, b) => b.stockCount - a.stockCount)
      .slice(0, 50) // Show top 50 new arrivals
  }, [products])

  const displayProducts = newArrivals.slice(0, visibleCount)
  const currentProduct = displayProducts[currentProductIndex] || null

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (arrowTimeoutRef.current) {
        clearTimeout(arrowTimeoutRef.current)
      }
    }
  }, [])

  // Reset to first product when displayProducts change
  useEffect(() => {
    if (currentProductIndex >= displayProducts.length && displayProducts.length > 0) {
      setCurrentProductIndex(0)
    }
  }, [displayProducts.length, currentProductIndex])

  const handleImageClick = () => {
    setShowArrows(true)
    if (arrowTimeoutRef.current) {
      clearTimeout(arrowTimeoutRef.current)
    }
    arrowTimeoutRef.current = setTimeout(() => {
      setShowArrows(false)
    }, 1000)
  }

  const handlePrevious = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (currentProductIndex > 0) {
      setCurrentProductIndex(currentProductIndex - 1)
      setShowArrows(true)
      if (arrowTimeoutRef.current) {
        clearTimeout(arrowTimeoutRef.current)
      }
      arrowTimeoutRef.current = setTimeout(() => {
        setShowArrows(false)
      }, 1000)
    }
  }

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (currentProductIndex < displayProducts.length - 1) {
      setCurrentProductIndex(currentProductIndex + 1)
      setShowArrows(true)
      if (arrowTimeoutRef.current) {
        clearTimeout(arrowTimeoutRef.current)
      }
      arrowTimeoutRef.current = setTimeout(() => {
        setShowArrows(false)
      }, 1000)
    }
  }

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < newArrivals.length) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, newArrivals.length))
        }
      },
      { threshold: 0.1 },
    )

    if (infiniteSentinelRef.current) {
      observer.observe(infiniteSentinelRef.current)
    }

    return () => observer.disconnect()
  }, [visibleCount, newArrivals.length])

  const effectiveWishlist = useMemo(() => {
    if (!wishlistFeatureEnabled) return []
    try {
      const stored = localStorage.getItem('wishlist')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }, [wishlistFeatureEnabled])

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
        <div>
          <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl">New Arrivals</h1>
          <p className="mt-4 text-lg text-slate-300">
            Discover our latest products. Fresh inventory updated in real-time.
          </p>
        </div>

        {displayProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-400">
            No new arrivals at the moment. Check back soon!
          </div>
        ) : currentProduct ? (
          <div className="relative">
            <article
              className="group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface/70 shadow-brand transition hover:-translate-y-1 hover:border-primary/60"
            >
              <div 
                className="relative aspect-video w-full overflow-hidden cursor-pointer"
                onClick={handleImageClick}
              >
                <img
                  src={currentProduct.imageUrl}
                  alt={currentProduct.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">
                  {currentProduct.category}
                </span>
                <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                  New
                </span>
                {/* Navigation Arrows */}
                {displayProducts.length > 1 && (
                  <>
                    {currentProductIndex > 0 && (
                      <button
                        onClick={handlePrevious}
                        className={`absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 backdrop-blur-sm p-3 text-white transition-opacity hover:bg-black/70 ${
                          showArrows ? 'opacity-100' : 'opacity-0'
                        }`}
                        aria-label="Previous product"
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}
                    {currentProductIndex < displayProducts.length - 1 && (
                      <button
                        onClick={handleNext}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 backdrop-blur-sm p-3 text-white transition-opacity hover:bg-black/70 ${
                          showArrows ? 'opacity-100' : 'opacity-0'
                        }`}
                        aria-label="Next product"
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-white truncate">{currentProduct.name}</p>
                    <p className="text-sm text-slate-400 line-clamp-2">{currentProduct.description}</p>
                  </div>
                  <span className="text-base font-semibold text-secondary flex-shrink-0">
                    {moneyFormatter.format(currentProduct.price)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                  <span>Stock</span>
                  <span
                    className={
                      currentProduct.stockCount <= 5
                        ? 'font-semibold text-secondary'
                        : 'font-semibold text-accent'
                    }
                  >
                    {currentProduct.stockCount} units
                  </span>
                </div>
                <div className="mt-auto flex flex-col gap-2">
                  <button
                    className="w-full rounded-full bg-primary/80 px-4 py-2 text-xs font-semibold text-white shadow-brand transition hover:bg-primary"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddToCart(currentProduct)
                    }}
                  >
                    Add to cart
                  </button>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:border-white/40"
                      onClick={(e) => {
                        e.stopPropagation()
                        onQuickView(currentProduct)
                      }}
                    >
                      Quick view
                    </button>
                    {wishlistFeatureEnabled && (
                      <button
                        className={`flex-1 rounded-full border px-3 py-1.5 text-xs transition ${
                          effectiveWishlist.some((item: Product) => item.id === currentProduct.id)
                            ? 'border-secondary bg-secondary/20 text-secondary'
                            : 'border-white/20 text-white/80 hover:border-white/40'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleWishlist(currentProduct)
                        }}
                      >
                        {effectiveWishlist.some((item: Product) => item.id === currentProduct.id) ? 'Saved' : 'Save'}
                      </button>
                    )}
                    <button
                      className="flex-1 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:border-white/40"
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewDetails(currentProduct)
                      }}
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </div>
        ) : null}

        {visibleCount < newArrivals.length && (
          <div ref={infiniteSentinelRef} className="h-10" />
        )}
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

