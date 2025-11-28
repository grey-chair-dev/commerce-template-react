import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { featureFlags, siteConfig } from './config'
import {
  subscribeToProducts,
  type Product,
  checkAdapterHealth,
  type ConnectionMode,
} from './dataAdapter'
import { initClientMonitors, reportClientError, trackMetric } from './monitoring'
import { useStackAuth, useUser } from './auth/StackAuthProvider'
import { SearchOverlay } from './components/SearchOverlay'
import { ProductDetailView } from './components/ProductDetailView'
import { CheckoutShippingPage } from './components/CheckoutShippingPage'
import { CheckoutPaymentPage } from './components/CheckoutPaymentPage'
import { CheckoutReviewPage } from './components/CheckoutReviewPage'
import { OrderConfirmationPage } from './components/OrderConfirmationPage'
import { OrderStatusPage } from './components/OrderStatusPage'
import { OrderLookupPage } from './components/OrderLookupPage'
import { UserDashboard } from './components/UserDashboard'
import { LoginPage } from './components/LoginPage'
import { SignUpPage } from './components/SignUpPage'
import { ForgotPasswordPage } from './components/ForgotPasswordPage'
import { ContactUsPage } from './components/ContactUsPage'
import { ShippingReturnsPage } from './components/ShippingReturnsPage'
import { PrivacyTermsPage } from './components/PrivacyTermsPage'
import { NotFoundPage } from './components/NotFoundPage'
import { MaintenancePage } from './components/MaintenancePage'
import { ComingSoonPage } from './components/ComingSoonPage'
import { AboutUsPage } from './components/AboutUsPage'
import { CatalogPage } from './components/CatalogPage'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { moneyFormatter } from './formatters'

export type CartItem = Product & { quantity: number }

const wishlistFeatureEnabled =
  (import.meta.env.VITE_ENABLE_WISHLIST ?? 'true').toString().toLowerCase() !== 'false'

const orderTrackingEnabled =
  (import.meta.env.VITE_ENABLE_ORDER_TRACKING ?? 'true').toString().toLowerCase() !== 'false'

const SectionShell = ({
  title,
  description,
  children,
}: {
  title: string | ReactNode
  description?: string
  children: ReactNode
}) => (
  <section className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:p-8 shadow-brand">
    <div className="mb-6 flex flex-col gap-2">
      <h2 className="text-2xl font-semibold text-text">{title}</h2>
      {description ? <p className="text-sm text-slate-300">{description}</p> : null}
    </div>
    {children}
  </section>
)

const ContactCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <p className="text-xs uppercase tracking-[0.4em] text-secondary">{label}</p>
    <p className="mt-2 text-base font-semibold text-white">{value}</p>
  </div>
)

const CookieBanner = ({
  onAccept,
  onDismiss,
}: {
  onAccept: () => void
  onDismiss: () => void
}) => (
  <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/20 bg-surface/90 p-4 text-sm text-slate-200 shadow-brand backdrop-blur">
    <p className="font-semibold text-white">Cookies & telemetry</p>
    <p className="text-slate-300">
      We use strictly necessary cookies plus optional analytics when enabled to measure latency
      and reliability. Accept to allow storing anonymous metrics in your browser.
    </p>
    <div className="flex flex-wrap gap-3">
      <button
        className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-brand"
        onClick={onAccept}
      >
        Accept
      </button>
      <button
        className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white/80"
        onClick={onDismiss}
      >
        Not now
      </button>
    </div>
  </div>
)

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading } = useUser()
  const { signInWithOAuth, signOut } = useStackAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('offline')
  const [adapterHealth, setAdapterHealth] = useState<'unknown' | 'healthy' | 'degraded'>(
    'unknown',
  )
  const [lastLatencyMs, setLastLatencyMs] = useState(0)
  const [showCookieBanner, setShowCookieBanner] = useState(false)
  const [isFilterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)
  const [isSearchOpen, setSearchOpen] = useState(false)
  const [pdpProduct, setPdpProduct] = useState<Product | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [wishlist, setWishlist] = useState<Product[]>([])
  const [isCartOpen, setCartOpen] = useState(false)
  const [isWishlistOpen, setWishlistOpen] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<'shipping' | 'payment' | 'review' | null>(null)
  const [shippingForm, setShippingForm] = useState<any>(null)
  const [paymentForm, setPaymentForm] = useState<any>(null)
  const [orderConfirmation, setOrderConfirmation] = useState<{
    orderNumber: string
    cartItems: CartItem[]
    shippingForm: any
    cartSubtotal: number
    estimatedShipping: number
    estimatedTax: number
  } | null>(null)
  const [orderStatusView, setOrderStatusView] = useState<{
    orderNumber: string
    cartItems: CartItem[]
    shippingForm: any
    cartSubtotal: number
    estimatedShipping: number
    estimatedTax: number
  } | null>(null)
  const [isOrderLookupOpen, setOrderLookupOpen] = useState(false)
  const [isDashboardOpen, setDashboardOpen] = useState(false)
  const [authPage, setAuthPage] = useState<'login' | 'signup' | 'forgot-password' | null>(null)

  // Navigation handlers using useNavigate
  const handleNavigate = {
    toContact: () => navigate('/contact'),
    toAbout: () => navigate('/about'),
    toCatalog: () => navigate('/catalog'),
    toShippingReturns: () => navigate('/shipping-returns'),
    toPrivacy: () => navigate('/privacy'),
    toTerms: () => navigate('/terms'),
    toDashboard: () => navigate('/dashboard'),
    toLogin: () => navigate('/login'),
    toSignUp: () => navigate('/signup'),
    toForgotPassword: () => navigate('/forgot-password'),
    toTrackOrder: () => navigate('/order-lookup'),
    toHome: () => navigate('/'),
  }
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0)
  const effectiveWishlist = wishlistFeatureEnabled ? wishlist : []
  const wishlistCount = effectiveWishlist.length

  const addToCart = (product: Product, quantity = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        )
      }
      return [...prev, { ...product, quantity }]
    })
    setCartOpen(true)
  }

  const updateCartQuantity = (productId: string, quantity: number) => {
    const safeQuantity = Number.isFinite(quantity) ? quantity : 0
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.max(0, safeQuantity) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId))
  }

  const cartSubtotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  )
  const estimatedShipping = cartSubtotal > 0 ? Math.max(5, cartSubtotal * 0.05) : 0
  const estimatedTax = cartSubtotal > 0 ? cartSubtotal * 0.0825 : 0

  const toggleWishlist = (product: Product) => {
    if (!wishlistFeatureEnabled) {
      return
    }
    setWishlist((prev) => {
      const exists = prev.some((item) => item.id === product.id)
      if (exists) {
        return prev.filter((item) => item.id !== product.id)
      }
      return [...prev, product]
    })
    setWishlistOpen(true)
  }

  const shareWishlist = () => {
    const names = effectiveWishlist.map((item) => item.name).join(', ')
    const payload = {
      title: 'My Local Commerce wishlist',
      text: `Here are the items I'm eyeing: ${names}`,
      url: window.location.origin,
    }
    if (navigator.share) {
      navigator.share(payload).catch(() => {
        navigator.clipboard?.writeText(`${payload.text} ${payload.url}`)
      })
    } else {
      navigator.clipboard?.writeText(`${payload.text} ${payload.url}`)
    }
  }
  const [pendingFilters, setPendingFilters] = useState<{
    category: string
    sortBy: 'featured' | 'priceAsc' | 'priceDesc'
  }>({
    category: 'All',
    sortBy: 'featured',
  })
  const lastEventRef = useRef(performance.now())

  useEffect(() => {
    const unsubscribe = subscribeToProducts(
      siteConfig.appId,
      (nextProducts) => {
        const now = performance.now()
        setProducts(nextProducts)
        setLastLatencyMs(Math.round(now - lastEventRef.current))
        lastEventRef.current = now
      },
      {
        onChannelChange: setConnectionMode,
      },
    )

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const teardown = initClientMonitors()
    return () => teardown()
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    const poll = async () => {
      try {
        const healthy = await checkAdapterHealth()
        if (!cancelled) {
          setAdapterHealth(healthy ? 'healthy' : 'degraded')
        }
      } catch {
        if (!cancelled) {
          setAdapterHealth('degraded')
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(poll, 30000)
        }
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  useEffect(() => {
    if (!lastLatencyMs) {
      return
    }
    trackMetric('adapter_latency_ms', lastLatencyMs, { mode: connectionMode })
  }, [lastLatencyMs, connectionMode])

  useEffect(() => {
    if (connectionMode === 'offline') {
      reportClientError('Adapter offline or unavailable', 'adapter.offline')
    }
  }, [connectionMode])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const consent = window.localStorage.getItem('lct_cookie_consent')
    setShowCookieBanner(!consent)
  }, [])

  const handleAcceptCookies = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('lct_cookie_consent', 'true')
    }
    setShowCookieBanner(false)
  }

  const handleDismissCookies = () => {
    setShowCookieBanner(false)
  }

  const handleOpenFilterDrawer = () => {
    setFilterDrawerOpen(true)
  }

  const handleApplyFilters = () => {
    // Filters are applied in the catalog page
    setFilterDrawerOpen(false)
  }

  const handleResetFilters = () => {
    setPendingFilters({ category: 'All', sortBy: 'featured' })
  }

  const categories = useMemo(() => {
    const unique = new Set(products.map((product) => product.category))
    return ['All', ...unique]
  }, [products])

  // New Arrivals - products with higher stock (likely newer)
  const newArrivals = useMemo(() => {
    return [...products]
      .sort((a, b) => b.stockCount - a.stockCount)
      .slice(0, 6)
  }, [products])


  const adapterHealthLabel =
    adapterHealth === 'healthy'
      ? 'Healthy'
      : adapterHealth === 'degraded'
        ? 'Needs attention'
        : 'Checking…'

  const statusColor =
    connectionMode === 'live'
      ? 'animate-pulse bg-accent'
      : connectionMode === 'snapshot'
        ? 'bg-primary'
        : connectionMode === 'mock'
          ? 'bg-secondary'
          : 'bg-rose-500'

  // Helper function to create page props
  const createPageProps = () => ({
    user,
    isLoading,
    cartCount,
    wishlistCount,
    wishlistFeatureEnabled,
    products,
    orderTrackingEnabled,
    onSignIn: handleNavigate.toLogin,
    onSignOut: signOut,
    onAccount: handleNavigate.toDashboard,
    onCart: () => setCartOpen(true),
    onWishlist: () => setWishlistOpen(true),
    onSearch: () => setSearchOpen(true),
    onProductSelect: (product: Product) => setPdpProduct(product),
    onTrackOrder: handleNavigate.toTrackOrder,
    onContactUs: handleNavigate.toContact,
    onAboutUs: handleNavigate.toAbout,
    onShippingReturns: handleNavigate.toShippingReturns,
    onPrivacyPolicy: handleNavigate.toPrivacy,
    onTermsOfService: handleNavigate.toTerms,
  })

  // Maintenance page handler
  const handleMaintenanceNotify = (email: string) => {
    console.log('Notification requested for:', email)
    if (typeof window !== 'undefined') {
      const notifications = JSON.parse(
        window.localStorage.getItem('lct_maintenance_notifications') || '[]',
      )
      notifications.push({ email, timestamp: Date.now() })
      window.localStorage.setItem(
        'lct_maintenance_notifications',
        JSON.stringify(notifications),
      )
    }
  }

  // Coming soon page handler
  const handleComingSoonNotify = (email: string) => {
    console.log('Coming soon notification requested for:', email)
    if (typeof window !== 'undefined') {
      const notifications = JSON.parse(
        window.localStorage.getItem('lct_coming_soon_notifications') || '[]',
      )
      notifications.push({ email, timestamp: Date.now() })
      window.localStorage.setItem(
        'lct_coming_soon_notifications',
        JSON.stringify(notifications),
      )
    }
  }

  // If coming soon page feature is enabled, show it as the only page
  if (featureFlags.enableComingSoonPage) {
    return (
      <ComingSoonPage
        message="We're building something amazing! Stay tuned for our grand opening."
        expectedLaunch="January 15, 2025"
        onNotifyMe={handleComingSoonNotify}
      />
    )
  }

  // If maintenance page feature is enabled, show it as the homepage
  if (featureFlags.enableMaintenancePage && location.pathname === '/') {
    return (
      <MaintenancePage
        reason="We are currently performing scheduled maintenance to improve your experience."
        expectedReturn="December 15, 2024 at 2:00 PM EST"
        onNotifyMe={handleMaintenanceNotify}
      />
    )
  }

  return (
    <>
      <Routes>
        {/* Coming Soon route (when feature is disabled, for testing) */}
        <Route
          path="/coming-soon"
          element={
            <ComingSoonPage
              message="We're building something amazing! Stay tuned for our grand opening."
              expectedLaunch="January 15, 2025"
              onNotifyMe={handleComingSoonNotify}
            />
          }
        />

        {/* Maintenance route (when feature is disabled, for testing) */}
        <Route
          path="/503"
          element={
            <MaintenancePage
              reason="We are currently performing scheduled maintenance to improve your experience."
              expectedReturn="December 15, 2024 at 2:00 PM EST"
              onNotifyMe={handleMaintenanceNotify}
            />
          }
        />

        {/* 404 Route */}
        <Route
          path="/404"
          element={
            <NotFoundPage
              {...createPageProps()}
              onProductSelect={(product) => {
                setPdpProduct(product)
                handleNavigate.toHome()
              }}
              onSearch={() => {
                setSearchOpen(true)
                handleNavigate.toHome()
              }}
            />
          }
        />

        {/* Contact Us Route */}
        <Route
          path="/contact"
          element={<ContactUsPage {...createPageProps()} />}
        />

        {/* About Us Route */}
        <Route
          path="/about"
          element={<AboutUsPage {...createPageProps()} />}
        />

        {/* Catalog/Menu Route */}
        <Route
          path="/catalog"
          element={
            <CatalogPage
              {...createPageProps()}
              onQuickView={(product) => setQuickViewProduct(product)}
              onViewDetails={(product) => setPdpProduct(product)}
              onToggleWishlist={toggleWishlist}
              onAddToCart={addToCart}
            />
          }
        />

        {/* Shipping & Returns Route */}
        <Route
          path="/shipping-returns"
          element={<ShippingReturnsPage {...createPageProps()} />}
        />

        {/* Privacy Policy Route */}
        <Route
          path="/privacy"
          element={<PrivacyTermsPage {...createPageProps()} />}
        />

        {/* Terms of Service Route */}
        <Route
          path="/terms"
          element={<PrivacyTermsPage {...createPageProps()} />}
        />

        {/* Homepage Route */}
        <Route
          path="/"
          element={
            <div className="flex min-h-screen flex-col">
              <Header
                user={user}
                isLoading={isLoading}
                cartCount={cartCount}
                wishlistCount={wishlistCount}
                wishlistFeatureEnabled={wishlistFeatureEnabled}
                products={products}
                onSignIn={handleNavigate.toLogin}
                onSignOut={() => signOut()}
                onAccount={handleNavigate.toDashboard}
                onCart={() => setCartOpen(true)}
                onWishlist={() => setWishlistOpen(true)}
                onSearch={() => setSearchOpen(true)}
                onProductSelect={(product) => setPdpProduct(product)}
              />

              <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 text-text sm:px-6 lg:px-8">
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 shadow-brand">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-4">
                      <p className="text-xs uppercase tracking-[0.4em] text-secondary">Live</p>
                      <h2 className="text-4xl font-semibold leading-tight text-text sm:text-5xl">
                        {siteConfig.hero.headline}
                      </h2>
                      <p className="max-w-2xl text-lg text-slate-100">
                        {siteConfig.hero.subheading}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <button className="rounded-full bg-primary px-8 py-3 text-base font-semibold text-white shadow-brand transition hover:bg-primary/80">
                          {siteConfig.hero.primaryCta}
                        </button>
                        <button className="rounded-full border border-white/30 px-8 py-3 text-base font-semibold text-white/80 hover:border-white/60">
                          {siteConfig.hero.secondaryCta}
                        </button>
                        <button
                          className="rounded-full border border-white/20 px-6 py-3 text-base font-semibold text-white/80 hover:border-white/40"
                          onClick={() => setSearchOpen(true)}
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

              {/* New Arrivals Section */}
              <SectionShell
                title="New Arrivals"
                description="Discover our latest products added this week. Fresh inventory updated in real-time."
              >
                {newArrivals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-400">
                    No new arrivals at the moment. Check back soon!
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                      {newArrivals.map((product) => (
                        <article
                          key={product.id}
                          className="flex min-w-[280px] max-w-[280px] flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface/70 shadow-brand transition hover:-translate-y-1 hover:border-primary/60"
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
                            <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                              New
                            </span>
                          </div>
                          <div className="flex flex-1 flex-col gap-3 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-lg font-semibold text-white truncate">{product.name}</p>
                                <p className="text-sm text-slate-400 line-clamp-2">{product.description}</p>
                              </div>
                              <span className="text-base font-semibold text-secondary flex-shrink-0">
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
                            <div className="mt-auto flex flex-col gap-2">
                              <button
                                className="w-full rounded-full bg-primary/80 px-4 py-2 text-xs font-semibold text-white shadow-brand"
                                onClick={() => addToCart(product)}
                              >
                                Add to cart
                              </button>
                              <div className="flex gap-2">
                                <button
                                  className="flex-1 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:border-white/40"
                                  onClick={() => setQuickViewProduct(product)}
                                >
                                  Quick view
                                </button>
                                <button
                                  className="flex-1 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:border-white/40"
                                  onClick={() => setPdpProduct(product)}
                                >
                                  Details
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                      {/* See More Card */}
                      <div className="flex min-w-[280px] max-w-[280px] flex-shrink-0 items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5">
                        <div className="flex flex-col items-center gap-4 p-6 text-center">
                          <p className="text-sm font-semibold text-white">See More</p>
                          <p className="text-xs text-slate-400">Browse all new arrivals</p>
                          <button
                            onClick={() => navigate('/catalog')}
                            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white shadow-brand hover:bg-primary/80"
                          >
                            View Catalog
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
                <SectionShell
                  title="Events & activations"
                  description="Toggle via config flags without touching JSX."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    {siteConfig.events.map((event) => (
                      <div
                        key={event.title}
                        className="rounded-2xl border border-white/10 bg-surface/70 p-5 text-slate-200"
                      >
                        <p className="text-xs uppercase tracking-[0.4em] text-secondary">
                          {event.date}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-white">{event.title}</h3>
                        <p className="text-sm text-slate-300">{event.description}</p>
                      </div>
                    ))}
                  </div>
                </SectionShell>
              ) : null}

              {/* Trust Elements */}
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:p-8">
                <h2 className="mb-6 text-2xl font-semibold text-text">Why Shop With Us</h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-primary/20 p-4">
                      <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-white">Secure Checkout</h3>
                    <p className="text-xs text-slate-400">SSL encrypted payments</p>
                  </div>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-accent/20 p-4">
                      <svg className="h-8 w-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-white">Free Returns</h3>
                    <p className="text-xs text-slate-400">30-day return policy</p>
                  </div>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-secondary/20 p-4">
                      <svg className="h-8 w-8 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-white">Fast Shipping</h3>
                    <p className="text-xs text-slate-400">1-2 day delivery</p>
                  </div>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-primary/20 p-4">
                      <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-white">24/7 Support</h3>
                    <p className="text-xs text-slate-400">Always here to help</p>
                  </div>
                </div>
              </section>

              {/* Promotional Sections */}
              <div className="grid gap-6 md:grid-cols-1">
                <section className="rounded-3xl border border-secondary/30 bg-gradient-to-br from-secondary/20 to-secondary/10 p-6 lg:p-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">⚡</span>
                    <h2 className="text-xl font-semibold text-white">Limited Time Offers</h2>
                  </div>
                  <p className="mb-4 text-sm text-slate-200">
                    Special deals and discounts on select items. Limited quantities available.
                  </p>
                  <button
                    onClick={() => {
                      navigate('/catalog')
                    }}
                    className="rounded-full border border-secondary/50 bg-secondary/20 px-6 py-2 text-sm font-semibold text-white hover:bg-secondary/30"
                  >
                    View Deals
                  </button>
                </section>
              </div>

              <SectionShell title="Visit / contact">
                <div className="grid gap-6 md:grid-cols-3">
                  <ContactCard label="Phone" value={siteConfig.contact.phone} />
                  <ContactCard label="Email" value={siteConfig.contact.email} />
                  <ContactCard label="Location" value={siteConfig.contact.location} />
                </div>
                <p className="mt-4 text-sm text-slate-400">Hours: {siteConfig.contact.hours}</p>
              </SectionShell>

              <button
                className="fixed bottom-6 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-brand transition hover:bg-primary/80 md:hidden"
                onClick={handleOpenFilterDrawer}
              >
                <span className="h-2 w-2 rounded-full bg-white" />
                Filters
              </button>

              </main>

              <Footer
                orderTrackingEnabled={orderTrackingEnabled}
                onTrackOrder={handleNavigate.toTrackOrder}
                onContactUs={handleNavigate.toContact}
                onAboutUs={handleNavigate.toAbout}
                onShippingReturns={handleNavigate.toShippingReturns}
                onPrivacyPolicy={handleNavigate.toPrivacy}
                onTermsOfService={handleNavigate.toTerms}
              />
            </div>
          }
        />

        {/* Catch-all 404 route */}
        <Route
          path="*"
          element={
            <NotFoundPage
              {...createPageProps()}
              onProductSelect={(product) => {
                setPdpProduct(product)
                handleNavigate.toHome()
              }}
              onSearch={() => {
                setSearchOpen(true)
                handleNavigate.toHome()
              }}
            />
          }
        />
      </Routes>

      {/* Global Modals/Overlays - Available on all pages */}
      {isFilterDrawerOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface/95 text-white md:hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <p className="text-base font-semibold">Filters & sorting</p>
            <button
              className="text-sm text-slate-300"
              onClick={() => setFilterDrawerOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-secondary">Category</p>
              <div className="mt-3 space-y-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm ${
                      pendingFilters.category === category
                        ? 'border-primary bg-primary/20'
                        : 'border-white/10 text-slate-200'
                    }`}
                    onClick={() =>
                      setPendingFilters((prev) => ({ ...prev, category }))
                    }
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-8">
              <p className="text-xs uppercase tracking-[0.3em] text-secondary">Sort</p>
              <div className="mt-3 space-y-2">
                {[
                  { value: 'featured', label: 'Inventory (desc)' },
                  { value: 'priceAsc', label: 'Price · low → high' },
                  { value: 'priceDesc', label: 'Price · high → low' },
                ].map((option) => (
                  <button
                    key={option.value}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm ${
                      pendingFilters.sortBy === option.value
                        ? 'border-primary bg-primary/20'
                        : 'border-white/10 text-slate-200'
                    }`}
                    onClick={() =>
                      setPendingFilters((prev) => ({
                        ...prev,
                        sortBy: option.value as 'featured' | 'priceAsc' | 'priceDesc',
                      }))
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 px-4 py-4">
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-full border border-white/30 px-4 py-3 text-sm font-semibold text-white/90"
                onClick={handleResetFilters}
              >
                Reset
              </button>
              <button
                className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                onClick={handleApplyFilters}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCookieBanner ? (
        <CookieBanner
          onAccept={handleAcceptCookies}
          onDismiss={handleDismissCookies}
        />
      ) : null}

      <SearchOverlay
        products={products}
        isOpen={isSearchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(product) => setPdpProduct(product)}
      />

      {isCartOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <div className="flex h-full w-full max-w-lg flex-col bg-surface/95 text-white shadow-brand">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-lg font-semibold">Shopping bag</p>
                <p className="text-xs text-slate-400">{cartCount} items</p>
              </div>
              <button
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80"
                onClick={() => setCartOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cartItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-300">
                  Your bag is empty. Add products to reserve them.
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-20 w-20 rounded-2xl object-cover"
                      />
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.name}</p>
                            <p className="text-xs text-slate-400">{item.category}</p>
                          </div>
                          <button
                            className="text-xs text-slate-400 hover:text-white"
                            onClick={() => removeFromCart(item.id)}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-sm text-white/80">
                          <div className="flex items-center gap-2">
                            <button
                              className="rounded-full border border-white/20 px-2 text-xs"
                              onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              className="h-8 w-14 rounded-full border border-white/10 bg-transparent text-center text-sm"
                              value={item.quantity}
                              onChange={(event) =>
                                updateCartQuantity(item.id, Number(event.target.value))
                              }
                            />
                            <button
                              className="rounded-full border border-white/20 px-2 text-xs"
                              onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                          <span className="font-semibold">
                            {moneyFormatter.format(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {cartItems.length > 0 ? (
                <p className="mt-3 text-xs text-secondary">
                  Items are not reserved until checkout. Complete your order to guarantee
                  availability.
                </p>
              ) : null}
            </div>

            <div className="border-t border-white/10 px-5 py-5">
              {/* Promo Code Field */}
              <div className="mb-4 space-y-2">
                <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Promo Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code"
                    className="flex-1 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                  />
                  <button className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 hover:border-white/40">
                    Apply
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-200">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{moneyFormatter.format(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Est. shipping (calculated at checkout)</span>
                  <span>{moneyFormatter.format(estimatedShipping)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Est. taxes</span>
                  <span>{moneyFormatter.format(estimatedTax)}</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Final shipping and taxes are confirmed during checkout once your address is
                provided.
              </p>
              <div className="mt-4 space-y-3">
                <button
                  className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                  onClick={() => {
                    setCartOpen(false)
                    // Check checkout mode - if pickup only, skip shipping page
                    const checkoutMode = (import.meta.env.VITE_CHECKOUT_MODE ?? 'both').toString().toLowerCase()
                    if (checkoutMode === 'pickup') {
                      // For pickup-only, create minimal shipping form and go to payment
                      setShippingForm({
                        deliveryMethod: 'pickup',
                        email: '',
                        firstName: '',
                        lastName: '',
                        phone: '',
                        address: '',
                        city: '',
                        state: '',
                        zipCode: '',
                      })
                      setCheckoutStep('payment')
                    } else {
                      // For delivery or both, show shipping page
                      setCheckoutStep('shipping')
                    }
                  }}
                >
                  Continue to Checkout
                </button>
                {!user ? (
                  <button
                    className="w-full rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                    onClick={() => {
                      setCartOpen(false)
                      handleNavigate.toLogin()
                    }}
                  >
                    Sign in for faster checkout
                  </button>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">Visa</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">
                  Mastercard
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">Amex</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">
                  SSL Secure
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {quickViewProduct ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-6 sm:items-center">
          <div className="w-full max-w-xl rounded-3xl bg-surface/95 shadow-brand">
            <div className="relative">
              <img
                src={quickViewProduct.imageUrl}
                alt={quickViewProduct.name}
                className="h-64 w-full rounded-t-3xl object-cover"
              />
              <button
                className="absolute right-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs text-white"
                onClick={() => setQuickViewProduct(null)}
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{quickViewProduct.name}</p>
                  <p className="text-sm text-slate-300">{quickViewProduct.description}</p>
                </div>
                <span className="text-base font-semibold text-secondary">
                  {moneyFormatter.format(quickViewProduct.price)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                <span>Category • {quickViewProduct.category}</span>
                <span className="text-white/70">·</span>
                <span>
                  {quickViewProduct.stockCount > 0
                    ? `${quickViewProduct.stockCount} in stock`
                    : 'Out of stock'}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                  onClick={() => quickViewProduct && addToCart(quickViewProduct)}
                >
                  Add to cart
                </button>
                {wishlistFeatureEnabled ? (
                  <button
                    className={`flex-1 rounded-full border px-4 py-3 text-sm font-semibold ${
                      effectiveWishlist.some((item) => item.id === quickViewProduct.id)
                        ? 'border-secondary text-secondary'
                        : 'border-white/20 text-white/80'
                    }`}
                    onClick={() => toggleWishlist(quickViewProduct)}
                  >
                    {effectiveWishlist.some((item) => item.id === quickViewProduct.id)
                      ? 'Saved'
                      : 'Save for later'}
                  </button>
                ) : null}
                <button
                  className="w-full rounded-full border border-primary/60 px-4 py-3 text-sm font-semibold text-primary"
                  onClick={() => {
                    setPdpProduct(quickViewProduct)
                    setQuickViewProduct(null)
                  }}
                >
                  View full details
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {wishlistFeatureEnabled && isWishlistOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <div className="flex h-full w-full max-w-md flex-col bg-surface/95 text-white shadow-brand">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-lg font-semibold">Wishlist</p>
                <p className="text-xs text-slate-400">{wishlistCount} saved items</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80"
                  onClick={shareWishlist}
                >
                  Share
                </button>
                <button
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80"
                  onClick={() => setWishlistOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {effectiveWishlist.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-300">
                  Save products you love to keep them handy.
                </div>
              ) : (
                <div className="space-y-4">
                  {effectiveWishlist.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.name}</p>
                            <p className="text-xs text-slate-400">{item.category}</p>
                          </div>
                          <button
                            className="text-xs text-slate-400 hover:text-white"
                            onClick={() => toggleWishlist(item)}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-sm text-white/80">
                          <span>{moneyFormatter.format(item.price)}</span>
                          <div className="flex gap-2">
                            <button
                              className="rounded-full border border-white/20 px-3 py-1 text-xs"
                              onClick={() => addToCart(item)}
                            >
                              Add to cart
                            </button>
                            <button
                              className="rounded-full border border-white/20 px-3 py-1 text-xs"
                              onClick={() => setPdpProduct(item)}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-white/10 px-5 py-5 text-xs text-slate-400">
              Share your wishlist or move items to cart whenever you're ready.
            </div>
          </div>
        </div>
      ) : null}

      {pdpProduct ? (
        <ProductDetailView
          product={pdpProduct}
          onClose={() => setPdpProduct(null)}
          onAddToCart={() => addToCart(pdpProduct)}
          onSave={wishlistFeatureEnabled ? () => toggleWishlist(pdpProduct) : undefined}
          isSaved={wishlistFeatureEnabled && effectiveWishlist.some((item) => item.id === pdpProduct.id)}
        />
      ) : null}

      {checkoutStep === 'shipping' ? (
        <CheckoutShippingPage
          cartSubtotal={cartSubtotal}
          estimatedShipping={estimatedShipping}
          estimatedTax={estimatedTax}
          onNext={(form) => {
            setShippingForm(form)
            setCheckoutStep('payment')
          }}
          onCancel={() => {
            setCheckoutStep(null)
            setShippingForm(null)
            setPaymentForm(null)
          }}
        />
      ) : null}

      {checkoutStep === 'payment' && shippingForm ? (
        <CheckoutPaymentPage
          shippingForm={shippingForm}
          cartSubtotal={cartSubtotal}
          estimatedShipping={estimatedShipping}
          estimatedTax={estimatedTax}
          onNext={(form) => {
            setPaymentForm(form)
            setCheckoutStep('review')
          }}
          onBack={() => setCheckoutStep('shipping')}
          onCancel={() => {
            setCheckoutStep(null)
            setShippingForm(null)
            setPaymentForm(null)
          }}
        />
      ) : null}

      {checkoutStep === 'review' && shippingForm && paymentForm ? (
        <CheckoutReviewPage
          cartItems={cartItems}
          shippingForm={shippingForm}
          paymentForm={paymentForm}
          cartSubtotal={cartSubtotal}
          estimatedShipping={estimatedShipping}
          estimatedTax={estimatedTax}
          onBack={() => {
            const checkoutMode = (import.meta.env.VITE_CHECKOUT_MODE ?? 'both').toString().toLowerCase()
            if (checkoutMode === 'pickup' || shippingForm?.deliveryMethod === 'pickup') {
              setCheckoutStep('payment')
            } else {
              setCheckoutStep('payment')
            }
          }}
          onComplete={() => {
            const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
            const completedOrderItems = [...cartItems]
            const completedShippingForm = { ...shippingForm }
            
            const orderData = {
              orderNumber,
              cartItems: completedOrderItems,
              shippingForm: completedShippingForm,
              cartSubtotal,
              estimatedShipping,
              estimatedTax,
            }
            
            try {
              const storedOrders = JSON.parse(localStorage.getItem('lct_orders') || '{}')
              storedOrders[orderNumber.toLowerCase()] = orderData
              localStorage.setItem('lct_orders', JSON.stringify(storedOrders))
            } catch (e) {
              console.error('Failed to store order', e)
            }
            
            setCheckoutStep(null)
            setCartItems([])
            setOrderConfirmation(orderData)
            setShippingForm(null)
            setPaymentForm(null)
          }}
          onCancel={() => {
            setCheckoutStep(null)
            setShippingForm(null)
            setPaymentForm(null)
          }}
        />
      ) : null}

      {orderConfirmation ? (
        <OrderConfirmationPage
          orderNumber={orderConfirmation.orderNumber}
          cartItems={orderConfirmation.cartItems}
          shippingForm={orderConfirmation.shippingForm}
          cartSubtotal={orderConfirmation.cartSubtotal}
          estimatedShipping={orderConfirmation.estimatedShipping}
          estimatedTax={orderConfirmation.estimatedTax}
          onViewOrderStatus={() => {
            setOrderStatusView({
              orderNumber: orderConfirmation.orderNumber,
              cartItems: orderConfirmation.cartItems,
              shippingForm: orderConfirmation.shippingForm,
              cartSubtotal: orderConfirmation.cartSubtotal,
              estimatedShipping: orderConfirmation.estimatedShipping,
              estimatedTax: orderConfirmation.estimatedTax,
            })
            setOrderConfirmation(null)
          }}
          onGoToDashboard={() => {
            setOrderConfirmation(null)
            setDashboardOpen(true)
          }}
          onContinueShopping={() => {
            setOrderConfirmation(null)
          }}
        />
      ) : null}

      {isOrderLookupOpen ? (
        <OrderLookupPage
          onBack={() => setOrderLookupOpen(false)}
          onOrderFound={(orderData) => {
            setOrderLookupOpen(false)
            setOrderStatusView(orderData)
          }}
          onContactSupport={() => {
            setOrderLookupOpen(false)
            handleNavigate.toContact()
          }}
        />
      ) : null}

      {orderStatusView ? (
        <OrderStatusPage
          orderNumber={orderStatusView.orderNumber}
          cartItems={orderStatusView.cartItems}
          shippingForm={orderStatusView.shippingForm}
          cartSubtotal={orderStatusView.cartSubtotal}
          estimatedShipping={orderStatusView.estimatedShipping}
          estimatedTax={orderStatusView.estimatedTax}
          currentStatus="confirmed"
          trackingNumber={undefined}
          estimatedDeliveryDate="December 15, 2024"
          onBack={() => setOrderStatusView(null)}
        />
      ) : null}

      {isDashboardOpen ? (
        <UserDashboard
          user={user}
          onBack={() => setDashboardOpen(false)}
          onViewOrder={(order) => {
            setDashboardOpen(false)
            setOrderStatusView({
              orderNumber: order.orderNumber,
              cartItems: order.cartItems,
              shippingForm: order.shippingForm,
              cartSubtotal: order.cartSubtotal,
              estimatedShipping: order.estimatedShipping,
              estimatedTax: order.estimatedTax,
            })
          }}
          onReOrder={(order) => {
            setCartItems(order.cartItems)
            setDashboardOpen(false)
            setCartOpen(true)
          }}
        />
      ) : null}

      {authPage === 'login' ? (
        <LoginPage
          onSignIn={async (provider) => {
            await signInWithOAuth(provider)
            setAuthPage(null)
          }}
          onSignUp={() => setAuthPage('signup')}
          onForgotPassword={() => setAuthPage('forgot-password')}
          onBack={() => setAuthPage(null)}
          isLoading={isLoading}
        />
      ) : null}

      {authPage === 'signup' ? (
        <SignUpPage
          onSignUp={async (provider) => {
            await signInWithOAuth(provider)
            setAuthPage(null)
          }}
          onSignIn={() => setAuthPage('login')}
          onBack={() => setAuthPage(null)}
          isLoading={isLoading}
        />
      ) : null}

      {authPage === 'forgot-password' ? (
        <ForgotPasswordPage
          onBack={() => setAuthPage('login')}
          onSignIn={() => setAuthPage('login')}
        />
      ) : null}
    </>
  )
}

export default App

