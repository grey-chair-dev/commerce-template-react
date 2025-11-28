import { useState, useMemo } from 'react'
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

type FAQItem = {
  id: string
  question: string
  answer: string
  category: 'shipping' | 'returns' | 'orders' | 'account' | 'products' | 'general'
}

const faqData: FAQItem[] = [
  {
    id: '1',
    question: 'How long does shipping take?',
    answer: 'Standard shipping typically takes 5-7 business days. Express shipping (2-3 business days) is available at checkout for an additional fee.',
    category: 'shipping',
  },
  {
    id: '2',
    question: 'What is your return policy?',
    answer: 'We accept returns within 30 days of purchase. Items must be unused and in original packaging. Please contact us to initiate a return.',
    category: 'returns',
  },
  {
    id: '3',
    question: 'How do I track my order?',
    answer: 'You can track your order by clicking "Track Order" in the footer and entering your order number and email address. You\'ll also receive tracking updates via email.',
    category: 'orders',
  },
  {
    id: '4',
    question: 'Can I cancel or modify my order?',
    answer: 'Orders can be cancelled or modified within 1 hour of placement. After that, please contact support immediately and we\'ll do our best to accommodate your request.',
    category: 'orders',
  },
  {
    id: '5',
    question: 'Do you offer local pickup?',
    answer: 'Yes! Local pickup is available at our store location. Select "Pickup" at checkout and we\'ll notify you when your order is ready.',
    category: 'shipping',
  },
  {
    id: '6',
    question: 'How do I create an account?',
    answer: 'Click "Sign in" in the header, then select "Sign up" to create an account. You can also sign up with Google or GitHub for faster registration.',
    category: 'account',
  },
  {
    id: '7',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and Apple Pay. All payments are processed securely.',
    category: 'general',
  },
  {
    id: '8',
    question: 'Are products in stock updated in real-time?',
    answer: 'Yes! Our inventory is synchronized in real-time with our point-of-sale system, so you always see current availability.',
    category: 'products',
  },
  {
    id: '9',
    question: 'How do I save items to my wishlist?',
    answer: 'Click the heart icon on any product card to save it to your wishlist. You can access your wishlist from the header menu when signed in.',
    category: 'account',
  },
  {
    id: '10',
    question: 'Do you ship internationally?',
    answer: 'Currently, we only ship within the United States. International shipping may be available in the future.',
    category: 'shipping',
  },
  {
    id: '11',
    question: 'What if my order is damaged or incorrect?',
    answer: 'Please contact us immediately with photos of the issue. We\'ll send a replacement or issue a full refund, whichever you prefer.',
    category: 'returns',
  },
  {
    id: '12',
    question: 'How do I update my shipping address?',
    answer: 'Sign in to your account, go to your dashboard, and click on "Addresses" to add or edit shipping addresses.',
    category: 'account',
  },
]

const categories = [
  { id: 'all', label: 'All Questions' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'returns', label: 'Returns' },
  { id: 'orders', label: 'Orders' },
  { id: 'account', label: 'Account' },
  { id: 'products', label: 'Products' },
  { id: 'general', label: 'General' },
] as const

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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [showContactForm, setShowContactForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [formSubmitted, setFormSubmitted] = useState(false)

  const filteredFAQs = useMemo(() => {
    let filtered = faqData

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((faq) => faq.category === selectedCategory)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (faq) =>
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query),
      )
    }

    return filtered
  }, [searchQuery, selectedCategory])

  const toggleItem = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In production, this would submit to a backend API
    setFormSubmitted(true)
    setTimeout(() => {
      setFormSubmitted(false)
      setShowContactForm(false)
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

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 text-text sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Contact Us & FAQ</h1>
            <p className="mt-2 text-sm text-slate-400">
              Find answers to common questions or get in touch with our team
            </p>
          </div>
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
            onClick={() => navigate('/')}
          >
            Close
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-8 lg:flex-row">
          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* Search Bar - Most Prominent */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search frequently asked questions..."
                className="w-full rounded-2xl border border-white/20 bg-white/5 px-6 py-4 pl-12 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
              <svg
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selectedCategory === category.id
                      ? 'bg-primary text-white'
                      : 'border border-white/20 bg-white/5 text-slate-300 hover:border-white/40'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>

            {/* FAQ Results */}
            {filteredFAQs.length > 0 ? (
              <div className="space-y-3">
                {filteredFAQs.map((faq) => (
                  <div
                    key={faq.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5"
                  >
                    <button
                      onClick={() => toggleItem(faq.id)}
                      className="flex w-full items-start justify-between gap-4 text-left"
                    >
                      <h3 className="flex-1 font-semibold text-white">{faq.question}</h3>
                      <svg
                        className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform ${
                          expandedItems.has(faq.id) ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {expandedItems.has(faq.id) && (
                      <p className="mt-3 text-sm leading-relaxed text-slate-300">{faq.answer}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                <p className="text-slate-400">No questions found</p>
                <p className="mt-2 text-sm text-slate-500">
                  Try adjusting your search or category filter
                </p>
              </div>
            )}

            {/* Escalation Path - Contact Form */}
            {!showContactForm ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="mb-2 text-lg font-semibold">Still need help?</h2>
                <p className="mb-4 text-sm text-slate-300">
                  Can't find what you're looking for? Get in touch with our support team.
                </p>
                <button
                  className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand hover:bg-primary/80"
                  onClick={() => setShowContactForm(true)}
                >
                  Contact Support
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="mb-4 text-lg font-semibold">Contact Support</h2>
                {formSubmitted ? (
                  <div className="text-center">
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
                    <p className="text-sm text-slate-300">
                      Thank you! We'll get back to you within 24 hours.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Subject *
                      </label>
                      <input
                        type="text"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        required
                        className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">
                        Message *
                      </label>
                      <textarea
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        required
                        rows={4}
                        className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                        onClick={() => setShowContactForm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                      >
                        Send Message
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Sidebar - Contact Info */}
          <div className="lg:w-80">
            <div className="sticky top-8 space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="mb-4 text-lg font-semibold">Get in Touch</h2>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Phone</p>
                    <a
                      href={`tel:${siteConfig.contact.phone}`}
                      className="mt-1 block font-semibold text-white hover:text-primary"
                    >
                      {siteConfig.contact.phone}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Email</p>
                    <a
                      href={`mailto:${siteConfig.contact.email}`}
                      className="mt-1 block font-semibold text-white hover:text-primary"
                    >
                      {siteConfig.contact.email}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Location</p>
                    <p className="mt-1 text-slate-300">{siteConfig.contact.location}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Hours</p>
                    <p className="mt-1 text-slate-300">{siteConfig.contact.hours}</p>
                  </div>
                </div>
              </div>
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

