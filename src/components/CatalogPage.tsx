import { useMemo, useState, useRef, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { Product } from '../dataAdapter'
import { moneyFormatter } from '../formatters'
import { siteConfig } from '../config'
import { Header } from './Header'
import { Footer } from './Footer'

type CatalogPageProps = {
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
const CLEARANCE_STOCK_THRESHOLD = 10 // Products with stock <= this are considered clearance

export function CatalogPage({
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
}: CatalogPageProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryFromUrl = searchParams.get('category')
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryFromUrl || 'All')
  const [sortBy, setSortBy] = useState<'featured' | 'priceAsc' | 'priceDesc'>('featured')
  const [showSaleOnly, setShowSaleOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const infiniteSentinelRef = useRef<HTMLDivElement>(null)

  // Update category when URL parameter changes
  useEffect(() => {
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl)
      setVisibleCount(BATCH_SIZE)
    }
  }, [categoryFromUrl])

  const categories = useMemo(() => {
    const cats = new Set<string>(['All'])
    products.forEach((p) => cats.add(p.category))
    return Array.from(cats).sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    let filtered = products

    // Filter by sale/clearance if enabled
    if (showSaleOnly) {
      filtered = filtered.filter((p) => p.stockCount <= CLEARANCE_STOCK_THRESHOLD)
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((p) => p.category === selectedCategory)
    }

    if (sortBy === 'priceAsc') {
      filtered = [...filtered].sort((a, b) => a.price - b.price)
    } else if (sortBy === 'priceDesc') {
      filtered = [...filtered].sort((a, b) => b.price - a.price)
    } else {
      filtered = [...filtered].sort((a, b) => b.stockCount - a.stockCount)
    }

    return filtered
  }, [products, selectedCategory, sortBy, showSaleOnly])

  const displayProducts = filteredProducts.slice(0, visibleCount)

  // Get wishlist from localStorage for checking if products are saved
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

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-36 pb-6 text-text sm:gap-8 sm:px-6 sm:pt-44 sm:pb-10 md:pt-56 lg:px-8">
        {/* Page Header */}
        <div className="space-y-3 sm:space-y-4">
          <h1 className="text-2xl font-semibold leading-tight text-text sm:text-4xl lg:text-5xl">
            Product Catalog
          </h1>
          <p className="max-w-2xl text-base text-slate-200 sm:text-lg">
            Browse our complete selection of products. Filter by category or sort to find exactly
            what you're looking for.
          </p>
        </div>

        {/* Mobile: Hours and CTA */}
        <div className="sm:hidden space-y-3 mb-4">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-[0.2em]">Store Hours</p>
              <p className="text-sm font-semibold text-white mt-1">{siteConfig.contact.hours}</p>
            </div>
            <button
              onClick={() => navigate('/contact')}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-primary/80 min-h-[44px] whitespace-nowrap"
            >
              Contact Us
            </button>
          </div>
        </div>

        {/* Desktop: Filters and Sort */}
        <div className="hidden sm:flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:rounded-3xl md:p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition min-h-[44px] sm:px-4 sm:text-sm ${
                showSaleOnly
                  ? 'border-secondary bg-secondary/20 text-white'
                  : 'border-white/10 text-slate-300 hover:border-white/30'
              }`}
              onClick={() => {
                setShowSaleOnly(!showSaleOnly)
                setVisibleCount(BATCH_SIZE)
              }}
            >
              {showSaleOnly ? 'Sale Items' : 'Sale Items'}
            </button>
            {categories.map((category) => (
              <button
                key={category}
                className={`rounded-full border px-3 py-2 text-xs transition min-h-[44px] sm:px-4 sm:text-sm ${
                  category === selectedCategory
                    ? 'border-primary bg-primary/20 text-white'
                    : 'border-white/10 text-slate-300 hover:border-white/30'
                }`}
                onClick={() => {
                  setSelectedCategory(category)
                  setVisibleCount(BATCH_SIZE)
                  // Update URL without page reload
                  if (category === 'All') {
                    setSearchParams({})
                  } else {
                    setSearchParams({ category })
                  }
                }}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <label className="text-xs uppercase tracking-[0.3em]">Sort</label>
            <select
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value as typeof sortBy)
                setVisibleCount(BATCH_SIZE)
              }}
              className="rounded-full border border-white/20 bg-transparent px-3 py-2 text-sm text-white focus:outline-none min-h-[44px] sm:px-4"
            >
              <option value="featured">Inventory (desc)</option>
              <option value="priceAsc">Price · low → high</option>
              <option value="priceDesc">Price · high → low</option>
            </select>
          </div>
        </div>

        {/* Product Grid */}
        {displayProducts.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
              {displayProducts.map((product) => (
                <article
                  key={product.id}
                  className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface/70 shadow-brand transition hover:-translate-y-1 hover:border-primary/60 cursor-pointer"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <div className="relative aspect-video w-full overflow-hidden">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {product.stockCount <= CLEARANCE_STOCK_THRESHOLD && (
                      <span className="absolute left-4 top-4 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-white">
                        Sale
                      </span>
                    )}
                    <span className={`absolute ${product.stockCount <= CLEARANCE_STOCK_THRESHOLD ? 'right-4 top-12' : 'right-4 top-4'} rounded-full bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white`}>
                      {product.category}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-white sm:text-lg truncate">{product.name}</p>
                        <p className="text-xs text-slate-400 sm:text-sm line-clamp-2">{product.description}</p>
                      </div>
                      <span className="text-sm font-semibold text-secondary flex-shrink-0 sm:text-base">
                        {moneyFormatter.format(product.price)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                      <span>Stock</span>
                      <span
                        className={
                          product.stockCount <= 5
                            ? 'font-semibold text-secondary'
                            : 'font-semibold text-accent'
                        }
                      >
                        {product.stockCount} units
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{
                          width: `${Math.min(100, (product.stockCount / 50) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        className="flex-1 rounded-full border border-white/20 px-3 py-2.5 text-xs text-white/80 hover:border-white/40 min-h-[44px] sm:px-4"
                        onClick={(e) => {
                          e.stopPropagation()
                          onQuickView(product)
                        }}
                      >
                        Quick view
                      </button>
                      <button
                        className="flex-1 rounded-full border border-white/20 px-3 py-2.5 text-xs text-white/80 hover:border-white/40 min-h-[44px] sm:px-4"
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewDetails(product)
                        }}
                      >
                        View details
                      </button>
                      {wishlistFeatureEnabled ? (
                        <button
                          className={`rounded-full border px-3 py-2.5 text-xs font-semibold min-h-[44px] sm:px-4 ${
                            effectiveWishlist.some((item: Product) => item.id === product.id)
                              ? 'border-secondary text-secondary'
                              : 'border-white/20 text-white/80 hover:border-white/40'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleWishlist(product)
                          }}
                        >
                          {effectiveWishlist.some((item: Product) => item.id === product.id)
                            ? 'Saved'
                            : 'Save'}
                        </button>
                      ) : null}
                      <button
                        className="w-full rounded-full bg-primary/80 px-4 py-2.5 text-xs font-semibold text-white shadow-brand min-h-[44px]"
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddToCart(product)
                        }}
                      >
                        Add to cart
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div ref={infiniteSentinelRef} />
            {visibleCount < filteredProducts.length ? (
              <div className="text-center">
                <button
                  className="rounded-full border border-white/20 px-6 py-2 text-sm text-white/80 hover:border-white/40"
                  onClick={() =>
                    setVisibleCount((prev) =>
                      Math.min(prev + BATCH_SIZE, filteredProducts.length),
                    )
                  }
                >
                  Load more
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/20 p-12 text-center">
            <p className="text-lg font-semibold text-white">No products found</p>
            <p className="mt-2 text-sm text-slate-400">
              No products match your current filters. Try selecting a different category.
            </p>
            <button
              className="mt-4 rounded-full border border-white/20 px-6 py-2 text-sm text-white/80 hover:border-white/40"
              onClick={() => {
                setSelectedCategory('All')
                setVisibleCount(BATCH_SIZE)
              }}
            >
              Show all products
            </button>
          </div>
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

