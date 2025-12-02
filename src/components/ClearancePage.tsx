import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Product } from '../dataAdapter'
import { moneyFormatter } from '../formatters'
import { Header } from './Header'
import { Footer } from './Footer'
import { Pagination } from './Pagination'

type ClearancePageProps = {
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

export function ClearancePage({
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
}: ClearancePageProps) {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [sortBy, setSortBy] = useState<'featured' | 'priceAsc' | 'priceDesc'>('featured')
  const [currentPage, setCurrentPage] = useState(1)

  // Filter products that are on clearance (low stock)
  const clearanceProducts = useMemo(() => {
    return products.filter((p) => p.stockCount <= CLEARANCE_STOCK_THRESHOLD)
  }, [products])

  const categories = useMemo(() => {
    const cats = new Set<string>(['All'])
    clearanceProducts.forEach((p) => cats.add(p.category))
    return Array.from(cats).sort()
  }, [clearanceProducts])

  const filteredProducts = useMemo(() => {
    let filtered = clearanceProducts

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((p) => p.category === selectedCategory)
    }

    if (sortBy === 'priceAsc') {
      filtered = [...filtered].sort((a, b) => a.price - b.price)
    } else if (sortBy === 'priceDesc') {
      filtered = [...filtered].sort((a, b) => b.price - a.price)
    } else {
      // For clearance, sort by stock (lowest first - most urgent)
      filtered = [...filtered].sort((a, b) => a.stockCount - b.stockCount)
    }

    return filtered
  }, [clearanceProducts, selectedCategory, sortBy])

  // Calculate pagination
  const totalPages = Math.ceil(filteredProducts.length / BATCH_SIZE)
  const startIndex = (currentPage - 1) * BATCH_SIZE
  const endIndex = startIndex + BATCH_SIZE
  const displayProducts = filteredProducts.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, sortBy])

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

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-4 pt-32 pb-6 text-text sm:gap-8 sm:px-6 sm:pt-44 sm:pb-10 md:pt-56 lg:pt-60 lg:px-8">
        {/* Page Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-semibold leading-tight text-text sm:text-5xl">
              Clearance & Sale
            </h1>
            <span className="rounded-full bg-secondary px-4 py-1 text-sm font-semibold text-white">
              Limited Stock
            </span>
          </div>
          <p className="max-w-2xl text-lg text-slate-200">
            Shop our clearance items while supplies last. Limited quantities available at great prices.
          </p>
        </div>

        {/* Filters and Sort */}
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  category === selectedCategory
                    ? 'border-primary bg-primary/20 text-white'
                    : 'border-white/10 text-slate-300 hover:border-white/30'
                }`}
                onClick={() => {
                  setSelectedCategory(category)
                  setCurrentPage(1)
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
                setCurrentPage(1)
              }}
              className="rounded-full border border-white/20 bg-transparent px-4 py-2 text-sm text-white focus:outline-none"
            >
              <option value="featured">Stock (lowest first)</option>
              <option value="priceAsc">Price · low → high</option>
              <option value="priceDesc">Price · high → low</option>
            </select>
          </div>
        </div>

        {/* Product Grid */}
        {displayProducts.length > 0 ? (
          <>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {displayProducts.map((product) => (
                <article
                  key={product.id}
                  className="relative flex flex-col overflow-hidden rounded-3xl border border-secondary/30 bg-surface/70 shadow-brand transition hover:-translate-y-1 hover:border-secondary/60 cursor-pointer"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  {/* Clearance Badge */}
                  <div className="absolute left-4 top-4 z-10 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-white">
                    Clearance
                  </div>
                  <div className="relative aspect-video w-full overflow-hidden">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">
                      {product.category}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{product.name}</p>
                        <p className="text-sm text-slate-400">{product.description}</p>
                      </div>
                      <span className="text-base font-semibold text-secondary">
                        {moneyFormatter.format(product.price)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                      <span>Stock</span>
                      <span className="font-semibold text-secondary">
                        {product.stockCount} {product.stockCount === 1 ? 'left' : 'left'}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-secondary transition-all"
                        style={{
                          width: `${Math.min(100, (product.stockCount / CLEARANCE_STOCK_THRESHOLD) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <button
                        className="flex-1 rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 hover:border-white/40"
                        onClick={(e) => {
                          e.stopPropagation()
                          onQuickView(product)
                        }}
                      >
                        Quick view
                      </button>
                      <button
                        className="flex-1 rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 hover:border-white/40"
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewDetails(product)
                        }}
                      >
                        View details
                      </button>
                      {wishlistFeatureEnabled ? (
                        <button
                          className={`rounded-full border px-4 py-2 text-xs font-semibold ${
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
                        className="w-full rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-white shadow-brand hover:bg-secondary/80"
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
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                className="mt-8"
              />
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/20 p-12 text-center">
            <p className="text-lg font-semibold text-white">No clearance items available</p>
            <p className="mt-2 text-sm text-slate-400">
              Check back soon for new clearance deals and special offers.
            </p>
            <button
              className="mt-4 rounded-full border border-white/20 px-6 py-2 text-sm text-white/80 hover:border-white/40"
              onClick={() => {
                setSelectedCategory('All')
                setCurrentPage(1)
              }}
            >
              View all products
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

