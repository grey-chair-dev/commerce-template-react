import { type ReactNode, useMemo, useRef, useState } from 'react'
import { featureFlags, siteConfig } from '../config'
import type { Product, ConnectionMode } from '../dataAdapter'
import { moneyFormatter } from '../formatters'

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
  <section className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:p-8 shadow-brand">
    <div className="mb-6">
      <h2 className="text-2xl font-semibold text-text">{title}</h2>
      {description ? <p className="mt-2 text-sm text-slate-300">{description}</p> : null}
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
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [sortBy, setSortBy] = useState<'featured' | 'priceAsc' | 'priceDesc'>('featured')
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const infiniteSentinelRef = useRef<HTMLDivElement>(null)

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

  const displayProducts = filteredProducts.slice(0, visibleCount)

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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 text-text sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 shadow-brand">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-secondary">Live</p>
            <h2 className="text-4xl font-semibold leading-tight text-text sm:text-5xl">
              {siteConfig.hero.headline}
            </h2>
            <p className="max-w-2xl text-lg text-slate-100">{siteConfig.hero.subheading}</p>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-full bg-primary px-8 py-3 text-base font-semibold text-white shadow-brand transition hover:bg-primary/80">
                {siteConfig.hero.primaryCta}
              </button>
              <button className="rounded-full border border-white/30 px-8 py-3 text-base font-semibold text-white/80 hover:border-white/60">
                {siteConfig.hero.secondaryCta}
              </button>
              <button
                className="rounded-full border border-white/20 px-6 py-3 text-base font-semibold text-white/80 hover:border-white/40"
                onClick={onSearch}
              >
                Search catalog
              </button>
            </div>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-surface/70 p-6 text-sm text-slate-300">
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
        title="Product catalog"
        description="Backed by the mandated onSnapshot adapter subscribed to /artifacts/{appId}/public/data/products."
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  category === selectedCategory
                    ? 'border-primary bg-primary/20 text-white'
                    : 'border-white/10 text-slate-300 hover:border-white/30'
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <label className="text-xs uppercase tracking-[0.3em]">Sort</label>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
              className="rounded-full border border-white/20 bg-transparent px-4 py-2 text-sm text-white focus:outline-none"
            >
              <option value="featured">Inventory (desc)</option>
              <option value="priceAsc">Price · low → high</option>
              <option value="priceDesc">Price · high → low</option>
            </select>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {displayProducts.map((product) => (
            <article
              key={product.id}
              className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface/70 shadow-brand transition hover:-translate-y-1 hover:border-primary/60"
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
                <div className="mt-auto flex flex-wrap gap-2">
                  <button
                    className="flex-1 rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 hover:border-white/40"
                    onClick={() => onQuickView(product)}
                  >
                    Quick view
                  </button>
                  <button
                    className="flex-1 rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 hover:border-white/40"
                    onClick={() => onViewDetails(product)}
                  >
                    View details
                  </button>
                  {wishlistFeatureEnabled ? (
                    <button
                      className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                        effectiveWishlist.some((item) => item.id === product.id)
                          ? 'border-secondary text-secondary'
                          : 'border-white/20 text-white/80 hover:border-white/40'
                      }`}
                      onClick={() => onToggleWishlist(product)}
                    >
                      {effectiveWishlist.some((item) => item.id === product.id) ? 'Saved' : 'Save'}
                    </button>
                  ) : null}
                  <button
                    className="w-full rounded-full bg-primary/80 px-4 py-2 text-xs font-semibold text-white shadow-brand"
                    onClick={() => onAddToCart(product)}
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
          <div className="mt-6 text-center">
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
        {filteredProducts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-400">
            No products found for "{selectedCategory}". Adjust your filters to see the live catalog
            feed.
          </div>
        ) : null}
      </SectionShell>

      {featureFlags.enableAbout ? (
        <SectionShell title={siteConfig.about.heading}>
          <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
            <p className="text-lg text-slate-200">{siteConfig.about.body}</p>
            <ul className="space-y-4 text-sm text-slate-300">
              {siteConfig.about.highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </SectionShell>
      ) : null}

      {featureFlags.enableEvents ? (
        <SectionShell title="Upcoming events">
          <div className="grid gap-6 sm:grid-cols-2">
            {siteConfig.events.map((event, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/5 p-6"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{event.title}</h3>
                  <span className="text-sm text-slate-400">{event.date}</span>
                </div>
                <p className="text-sm text-slate-300">{event.description}</p>
              </div>
            ))}
          </div>
        </SectionShell>
      ) : null}
    </main>
  )
}

