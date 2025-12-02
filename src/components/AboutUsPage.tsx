import { useNavigate } from 'react-router-dom'
import { siteConfig } from '../config'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Product } from '../dataAdapter'

type AboutUsPageProps = {
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
  onContactUs?: () => void
  onShippingReturns?: () => void
  onPrivacyPolicy?: () => void
  onTermsOfService?: () => void
}

type StaffMember = {
  name: string
  role: string
  bio: string
  imageUrl: string
}

const staffMembers: StaffMember[] = [
  {
    name: 'Sarah Chen',
    role: 'Founder & Curator',
    bio: 'Started Harbor Market Collective to bridge local makers with their communities. Passionate about sustainable, authentic retail experiences.',
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
  },
  {
    name: 'Marcus Rodriguez',
    role: 'Operations Lead',
    bio: 'Ensures every product meets our quality standards. Loves connecting customers with the perfect local find.',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
  },
  {
    name: 'Emma Thompson',
    role: 'Community Manager',
    bio: 'Builds relationships with local artisans and organizes community events. Believes in the power of local commerce.',
    imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
  },
  {
    name: 'James Park',
    role: 'Head of Experience',
    bio: 'Crafts seamless shopping experiences both online and in-store. Dedicated to making local commerce accessible to everyone.',
    imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
  },
]

export function AboutUsPage({
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
  onShippingReturns,
  onPrivacyPolicy,
  onTermsOfService,
}: AboutUsPageProps) {
  const navigate = useNavigate()
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">About Us</h1>
        </div>

        {/* Mission Section */}
        <section className="mb-12">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 lg:p-12">
            <h2 className="mb-4 text-2xl font-semibold text-white">Our Mission</h2>
            <p className="mb-6 text-lg leading-relaxed text-slate-200">
              {siteConfig.about.body}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {siteConfig.about.highlights.map((highlight, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                  <span className="text-sm text-slate-300">{highlight}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Video Section (Optional) */}
        <section className="mb-12">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 lg:p-12">
            <h2 className="mb-4 text-2xl font-semibold text-white">Our Story</h2>
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-white/5">
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-slate-400">
                    Video coming soon: Learn about our journey and values
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="mb-12">
          <h2 className="mb-8 text-2xl font-semibold text-white">Meet Our Team</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {staffMembers.map((member) => (
              <div
                key={member.name}
                className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition hover:border-primary/60"
              >
                <div className="mb-4 h-32 w-32 overflow-hidden rounded-full border-2 border-white/20">
                  <img
                    src={member.imageUrl}
                    alt={member.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-white">{member.name}</h3>
                <p className="mb-3 text-sm text-accent">{member.role}</p>
                <p className="text-xs leading-relaxed text-slate-300">{member.bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Values Section */}
        <section className="mb-12">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 lg:p-12">
            <h2 className="mb-6 text-2xl font-semibold text-white">Our Values</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="mb-2 text-lg font-semibold text-white">Sustainability</h3>
                <p className="text-sm text-slate-300">
                  We prioritize eco-friendly practices and support local, sustainable production.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="mb-2 text-lg font-semibold text-white">Community First</h3>
                <p className="text-sm text-slate-300">
                  Building strong relationships with local makers and our neighborhood.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="mb-2 text-lg font-semibold text-white">Authenticity</h3>
                <p className="text-sm text-slate-300">
                  Every product tells a story. We celebrate genuine craftsmanship and quality.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-primary/20 to-accent/20 p-8 text-center">
          <h2 className="mb-4 text-2xl font-semibold text-white">Get in Touch</h2>
          <p className="mb-6 text-slate-200">
            Have questions? Want to collaborate? We'd love to hear from you.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Send us an email
            </a>
            <a
              href={`tel:${siteConfig.contact.phone}`}
              className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Call us
            </a>
          </div>
        </section>
      </main>

      <Footer
        orderTrackingEnabled={orderTrackingEnabled}
        onTrackOrder={onTrackOrder}
        onContactUs={onContactUs || (() => {})}
        onAboutUs={() => navigate('/about')}
        onShippingReturns={onShippingReturns || (() => {})}
        onPrivacyPolicy={onPrivacyPolicy || (() => {})}
        onTermsOfService={onTermsOfService || (() => {})}
      />
    </div>
  )
}

