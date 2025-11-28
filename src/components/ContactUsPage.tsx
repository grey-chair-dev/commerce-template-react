import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { siteConfig } from '../config'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Product } from '../dataAdapter'

type ContactUsPageProps = {
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
  onAboutUs?: () => void
  onShippingReturns?: () => void
  onPrivacyPolicy?: () => void
  onTermsOfService?: () => void
}

export function ContactUsPage({
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
  onAboutUs,
  onShippingReturns,
  onPrivacyPolicy,
  onTermsOfService,
}: ContactUsPageProps) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [formSubmitted, setFormSubmitted] = useState(false)

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In production, this would submit to a backend API
    setFormSubmitted(true)
    setTimeout(() => {
      setFormSubmitted(false)
      setFormData({ name: '', email: '', subject: '', message: '' })
    }, 2000)
  }

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

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pt-24 pb-10 text-text sm:px-6 sm:pt-32 md:pt-44 lg:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          {/* Header */}
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-text sm:text-5xl">Contact Us</h1>
            <p className="max-w-2xl text-lg text-slate-200">
              Get in touch with our team. We're here to help!
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
            {/* Contact Form */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:p-8 shadow-brand">
              <h2 className="mb-6 text-2xl font-semibold text-white">Send us a message</h2>
              {formSubmitted ? (
                <div className="text-center py-8">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
                    <svg
                      className="h-8 w-8 text-accent"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-white">Thank you!</p>
                  <p className="mt-2 text-sm text-slate-300">
                    We'll get back to you within 24 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-300">
                      Name *
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">
                      Email *
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      placeholder="your.email@example.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="subject" className="mb-2 block text-sm font-medium text-slate-300">
                      Subject *
                    </label>
                    <input
                      id="subject"
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      required
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      placeholder="What's this about?"
                    />
                  </div>
                  <div>
                    <label htmlFor="message" className="mb-2 block text-sm font-medium text-slate-300">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                      rows={6}
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none resize-none"
                      placeholder="Tell us how we can help..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-full bg-primary px-6 py-4 text-base font-semibold text-white shadow-brand hover:bg-primary/80 transition"
                  >
                    Send Message
                  </button>
                </form>
              )}
            </div>

            {/* Contact Info Sidebar */}
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-brand">
                <h2 className="mb-6 text-xl font-semibold text-white">Get in Touch</h2>
                <div className="space-y-6 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">Phone</p>
                    <a
                      href={`tel:${siteConfig.contact.phone}`}
                      className="block font-semibold text-white hover:text-primary transition"
                    >
                      {siteConfig.contact.phone}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">Email</p>
                    <a
                      href={`mailto:${siteConfig.contact.email}`}
                      className="block font-semibold text-white hover:text-primary transition"
                    >
                      {siteConfig.contact.email}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">Location</p>
                    <p className="text-slate-300 leading-relaxed">{siteConfig.contact.location}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">Hours</p>
                    <p className="text-slate-300 leading-relaxed">{siteConfig.contact.hours}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-brand">
                <h3 className="mb-4 text-lg font-semibold text-white">Need immediate help?</h3>
                <p className="mb-4 text-sm text-slate-300">
                  Check out our <a href="/faq" className="text-primary hover:underline">FAQ page</a> for quick answers to common questions.
                </p>
                <button
                  onClick={() => navigate('/faq')}
                  className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/40 transition"
                >
                  Visit FAQ
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer
        orderTrackingEnabled={orderTrackingEnabled}
        onTrackOrder={onTrackOrder}
        onContactUs={() => navigate('/contact')}
        onAboutUs={onAboutUs}
        onShippingReturns={onShippingReturns}
        onPrivacyPolicy={onPrivacyPolicy}
        onTermsOfService={onTermsOfService}
      />
    </div>
  )
}
