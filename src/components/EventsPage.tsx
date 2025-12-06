import { useNavigate, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { siteConfig } from '../config'

type EventsPageProps = {
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

export function EventsPage({
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
}: EventsPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isBookPage = location.pathname === '/events/book'
  const isPastPage = location.pathname === '/events/past'

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
          {isBookPage ? (
            <>
              <div>
                <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl">Book an Event</h1>
                <p className="mt-4 text-lg text-slate-300">
                  Host your event at Spiral Groove
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
                <h2 className="text-2xl font-semibold text-white">Event Booking</h2>
                <p className="mt-4 text-slate-300">
                  Interested in hosting an event at Spiral Groove? We'd love to hear from you!
                </p>
                <p className="mt-4 text-slate-300">
                  Contact us to discuss availability, pricing, and event details.
                </p>
                <button
                  onClick={onContactUs}
                  className="mt-6 rounded-full bg-primary px-6 py-3 text-base font-semibold text-white shadow-brand transition hover:bg-primary/80"
                >
                  Contact Us to Book
                </button>
              </div>
            </>
          ) : isPastPage ? (
            <>
              <div>
                <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl">Past Events</h1>
                <p className="mt-4 text-lg text-slate-300">
                  A look back at our previous events
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
                <p className="text-slate-300">Past events archive coming soon</p>
                <p className="mt-2 text-sm text-slate-400">
                  Check back to see photos and recaps from our previous events
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl">Events</h1>
                <p className="mt-4 text-lg text-slate-300">
                  Join us for live music, listening parties, and community events
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {siteConfig.events.map((event, index) => (
                  <div
                    key={index}
                    className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-brand"
                  >
                    <p className="text-xs uppercase tracking-[0.4em] text-secondary">{event.date}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{event.title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{event.description}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
                <h2 className="text-2xl font-semibold text-white">Want to book an event?</h2>
                <p className="mt-2 text-slate-300">Contact us to host your event at Spiral Groove</p>
                <button
                  onClick={() => navigate('/events/book')}
                  className="mt-6 rounded-full bg-primary px-6 py-3 text-base font-semibold text-white shadow-brand transition hover:bg-primary/80"
                >
                  Book an Event
                </button>
              </div>
            </>
          )}
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

