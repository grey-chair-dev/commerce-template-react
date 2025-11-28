import { useMemo, useState } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'

type FAQPageProps = {
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
    answer: 'Standard shipping typically takes 3-5 business days. Express shipping (1-2 business days) is available at checkout for an additional fee.',
    category: 'shipping',
  },
  {
    id: '2',
    question: 'What is your return policy?',
    answer: 'We offer a 30-day return policy on all unused items in their original packaging. Items must be in new condition with tags attached.',
    category: 'returns',
  },
  {
    id: '3',
    question: 'How do I track my order?',
    answer: 'Once your order ships, you\'ll receive a tracking number via email. You can also track your order from your account dashboard or use our order lookup tool.',
    category: 'orders',
  },
  {
    id: '4',
    question: 'Can I cancel or modify my order?',
    answer: 'Orders can be cancelled or modified within 1 hour of placement. After that, please contact us immediately and we\'ll do our best to accommodate your request.',
    category: 'orders',
  },
  {
    id: '5',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and Apple Pay. All payments are processed securely through encrypted connections.',
    category: 'general',
  },
  {
    id: '6',
    question: 'Do you offer gift wrapping?',
    answer: 'Yes! Gift wrapping is available at checkout for an additional fee. You can also include a personalized message with your gift.',
    category: 'general',
  },
  {
    id: '7',
    question: 'How do I create an account?',
    answer: 'Click "Sign In" in the header, then select "Create Account". You can sign up with email or use social login options. Creating an account allows you to track orders, save addresses, and manage your wishlist.',
    category: 'account',
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
  {
    id: '13',
    question: 'Are there any shipping restrictions?',
    answer: 'Some items may have shipping restrictions based on size, weight, or destination. These will be noted on the product page and at checkout.',
    category: 'shipping',
  },
  {
    id: '14',
    question: 'Can I return sale items?',
    answer: 'Yes, sale and clearance items follow the same 30-day return policy as regular items, as long as they meet the return conditions.',
    category: 'returns',
  },
  {
    id: '15',
    question: 'How do I know if an item is in stock?',
    answer: 'Each product page shows the current stock count. Items with low stock (10 or fewer) are marked as "Limited Stock" or "Sale" to indicate urgency.',
    category: 'products',
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

export function FAQPage({
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
}: FAQPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

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

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 pt-32 pb-10 text-text sm:px-6 sm:pt-44 md:pt-56 lg:pt-60 lg:px-8">
        {/* Page Header */}
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-semibold leading-tight text-text sm:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-slate-200">
            Find answers to common questions about our products, shipping, returns, and more.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-white/20 bg-white/5 px-6 py-4 pl-12 text-white placeholder-slate-400 focus:border-primary focus:outline-none"
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
              className={`rounded-full border px-4 py-2 text-sm transition ${
                selectedCategory === category.id
                  ? 'border-primary bg-primary/20 text-white'
                  : 'border-white/10 text-slate-300 hover:border-white/30'
              }`}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* FAQ Results */}
        {filteredFAQs.length > 0 ? (
          <div className="space-y-4">
            {filteredFAQs.map((faq) => (
              <div
                key={faq.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20"
              >
                <button
                  onClick={() => toggleItem(faq.id)}
                  className="flex w-full items-start justify-between gap-4 text-left"
                >
                  <h3 className="flex-1 text-lg font-semibold text-white">{faq.question}</h3>
                  <svg
                    className={`h-6 w-6 flex-shrink-0 text-slate-400 transition-transform ${
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
                  <p className="mt-4 text-base leading-relaxed text-slate-300">{faq.answer}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-12 text-center">
            <p className="text-lg font-semibold text-white">No questions found</p>
            <p className="mt-2 text-sm text-slate-400">
              Try adjusting your search or category filter
            </p>
          </div>
        )}

        {/* Contact CTA */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/10 p-8 text-center">
          <h2 className="text-2xl font-semibold text-white mb-2">Still have questions?</h2>
          <p className="text-slate-300 mb-6">
            Can't find what you're looking for? Our team is here to help.
          </p>
          <button
            onClick={onContactUs}
            className="rounded-full bg-primary px-8 py-3 text-base font-semibold text-white shadow-brand hover:bg-primary/80 transition"
          >
            Contact Us
          </button>
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
