import { type ReactNode, useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { featureFlags, siteConfig } from '../config'
import type { Product, ConnectionMode } from '../dataAdapter'
import { moneyFormatter } from '../formatters'
import { Pagination } from '../components/Pagination'

type HomePageProps = {
  products: Product[]
  connectionMode: ConnectionMode
  lastLatencyMs: number
  adapterHealth: 'unknown' | 'healthy' | 'degraded'
  wishlistFeatureEnabled: boolean
  wishlist: Product[]
  onQuickView: (product: Product) => void
  onViewDetails: (product: Product) => void
  onToggleWishlist: (product: Product) => void
  onAddToCart: (product: Product) => void
  onSearch: () => void
}

const SectionShell = ({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) => (
  <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-brand sm:rounded-3xl sm:p-6 lg:p-8">
    <div className="mb-4 sm:mb-6">
      <h2 className="text-xl font-semibold text-text sm:text-2xl">{title}</h2>
      {description ? <p className="mt-2 text-xs text-slate-300 sm:text-sm">{description}</p> : null}
    </div>
    {children}
  </section>
)

const BATCH_SIZE = 12

export function HomePage({
  products,
  connectionMode,
  lastLatencyMs,
  adapterHealth,
  wishlistFeatureEnabled,
  wishlist,
  onQuickView,
  onViewDetails,
  onToggleWishlist,
  onAddToCart,
  onSearch,
}: HomePageProps) {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [sortBy, setSortBy] = useState<'featured' | 'priceAsc' | 'priceDesc'>('featured')
  const [currentPage, setCurrentPage] = useState(1)

  const categories = useMemo(() => {
    const cats = new Set<string>(['All'])
    products.forEach((p) => cats.add(p.category))
    return Array.from(cats).sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    let filtered = products

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
  }, [products, selectedCategory, sortBy])

  // Calculate pagination
  const totalPages = Math.ceil(filteredProducts.length / BATCH_SIZE)
  const startIndex = (currentPage - 1) * BATCH_SIZE
  const endIndex = startIndex + BATCH_SIZE
  const displayProducts = filteredProducts.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, sortBy])

  const adapterHealthLabel =
    adapterHealth === 'healthy'
      ? 'Healthy'
      : adapterHealth === 'degraded'
        ? 'Degraded'
        : 'Checking…'

  const statusColor =
    connectionMode === 'live'
      ? 'animate-pulse bg-accent'
      : connectionMode === 'snapshot'
        ? 'bg-primary'
        : connectionMode === 'mock'
          ? 'bg-secondary'
          : 'bg-rose-500'

  const effectiveWishlist = wishlistFeatureEnabled ? wishlist : []

  return (
<<<<<<< HEAD
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-32 pb-6 text-text sm:gap-8 sm:px-6 sm:pt-44 sm:pb-10 md:pt-56 lg:pt-60 lg:px-8">
=======
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 text-text sm:gap-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
>>>>>>> aba70b3a637a56e82f7ca9c21200a91188d65a9d
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 shadow-brand sm:rounded-3xl sm:p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 sm:space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-secondary">Live</p>
            <h2 className="text-2xl font-semibold leading-tight text-text sm:text-4xl lg:text-5xl">
              {siteConfig.hero.headline}
            </h2>
            <p className="max-w-2xl text-base text-slate-100 sm:text-lg">{siteConfig.hero.subheading}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
              <button className="w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-brand transition hover:bg-primary/80 min-h-[44px] sm:w-auto sm:px-8 sm:text-base">
                {siteConfig.hero.primaryCta}
              </button>
              <button className="w-full rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/60 min-h-[44px] sm:w-auto sm:px-8 sm:text-base">
                {siteConfig.hero.secondaryCta}
              </button>
              <button
                className="w-full rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/40 min-h-[44px] sm:w-auto sm:px-6 sm:text-base"
                onClick={onSearch}
              >
                Search catalog
              </button>
            </div>
          </div>
          <div className="w-full rounded-2xl border border-white/20 bg-surface/70 p-4 text-sm text-slate-300 sm:max-w-sm sm:p-6">
            <p className="text-xs uppercase tracking-[0.4em] text-secondary">
              Real-time adapter health
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-4xl font-semibold text-text">
                {connectionMode === 'snapshot'
                  ? 'Snapshot'
                  : connectionMode === 'mock'
                    ? 'Mock mode'
                    : connectionMode === 'offline'
                      ? 'Offline'
                      : 'Live'}
              </span>
              <span className={`h-3 w-3 rounded-full ${statusColor}`} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Last diff landed in {lastLatencyMs} ms · Target {'<'} 1000 ms
            </p>
            <p className="text-xs text-slate-400">
              Adapter status:{' '}
              <span
                className={
                  adapterHealth === 'healthy'
                    ? 'text-accent'
                    : adapterHealth === 'degraded'
                      ? 'text-secondary'
                      : 'text-slate-200'
                }
              >
                {adapterHealthLabel}
              </span>
            </p>
            <p className="mt-4 text-xs text-slate-400">
              Source-of-truth: Neon · Origin: Square POS · Cache: Upstash Redis
            </p>
          </div>
        </div>
      </section>

      <SectionShell
        title="Shop Vinyl Records"
        description="Backed by the mandated onSnapshot adapter subscribed to /artifacts/{appId}/public/data/products."
      >
        {/* Mobile: Hours and CTA */}
        <div className="sm:hidden space-y-3 mb-4">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-[0.2em]">Store Hours</p>
              <p className="text-sm font-semibold text-white mt-1">{siteConfig.contact.hours}</p>
            </div>
            <button
              onClick={() => navigate('/shop')}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-primary/80 min-h-[44px] whitespace-nowrap"
            >
              {siteConfig.hero.primaryCta}
            </button>
          </div>
        </div>

        {/* Desktop: Filters and Sort */}
        <div className="hidden sm:flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
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
              className="rounded-full border border-white/20 bg-transparent px-3 py-2 text-sm text-white focus:outline-none min-h-[44px] sm:px-4"
            >
              <option value="featured">Inventory (desc)</option>
              <option value="priceAsc">Price · low → high</option>
              <option value="priceDesc">Price · high → low</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:mt-6 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
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
                <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">
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
                        effectiveWishlist.some((item) => item.id === product.id)
                          ? 'border-secondary text-secondary'
                          : 'border-white/20 text-white/80 hover:border-white/40'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleWishlist(product)
                      }}
                    >
                      {effectiveWishlist.some((item) => item.id === product.id) ? 'Saved' : 'Save'}
                    </button>
                  ) : null}
                  <button
                    className="w-full rounded-full bg-primary/80 px-4 py-2.5 text-xs font-semibold text-white shadow-brand min-h-[44px] sm:w-full"
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
        {filteredProducts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-400">
            No products found for "{selectedCategory}". Adjust your filters to see the live catalog
            feed.
          </div>
        ) : null}
      </SectionShell>

      {featureFlags.enableAbout ? (
        <SectionShell title={siteConfig.about.heading}>
          <div className="grid gap-6 lg:grid-cols-[2fr,1fr] lg:gap-8">
            <p className="text-base text-slate-200 sm:text-lg">{siteConfig.about.body}</p>
            <ul className="space-y-3 text-sm text-slate-300 sm:space-y-4">
              {siteConfig.about.highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4"
                >
                  <span className="mt-1 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </SectionShell>
      ) : null}

      {featureFlags.enableEvents ? (
        <SectionShell title="Upcoming events">
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            {siteConfig.events.map((event, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6"
              >
                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-base font-semibold text-white sm:text-lg">{event.title}</h3>
                  <span className="text-xs text-slate-400 sm:text-sm">{event.date}</span>
                </div>
                <p className="text-xs text-slate-300 sm:text-sm">{event.description}</p>
              </div>
            ))}
          </div>
        </SectionShell>
      ) : null}
    </main>
  )
}

