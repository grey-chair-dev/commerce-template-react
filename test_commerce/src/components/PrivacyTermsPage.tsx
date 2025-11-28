import { useNavigate, useParams } from 'react-router-dom'
import { siteConfig } from '../config'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Product } from '../dataAdapter'

type PrivacyTermsPageProps = {
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
  onContactUs?: () => void
  onShippingReturns?: () => void
}

export function PrivacyTermsPage({
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
  onContactUs,
  onShippingReturns,
}: PrivacyTermsPageProps) {
  const navigate = useNavigate()
  const { type } = useParams<{ type: 'privacy' | 'terms' }>()
  const pageType = type || 'privacy'
  const isPrivacy = pageType === 'privacy'

  // Table of Contents for Privacy Policy
  const privacyTOC = [
    { id: 'data-collected', label: 'Data Collected' },
    { id: 'how-we-use', label: 'How We Use Your Data' },
    { id: 'data-sharing', label: 'Data Sharing' },
    { id: 'data-security', label: 'Data Security' },
    { id: 'your-rights', label: 'Your Rights' },
    { id: 'cookies', label: 'Cookies & Tracking' },
    { id: 'changes', label: 'Policy Changes' },
    { id: 'contact', label: 'Contact Us' },
  ]

  // Table of Contents for Terms of Service
  const termsTOC = [
    { id: 'acceptance', label: 'Acceptance of Terms' },
    { id: 'use-of-service', label: 'Use of Service' },
    { id: 'user-accounts', label: 'User Accounts' },
    { id: 'products-pricing', label: 'Products & Pricing' },
    { id: 'orders-payment', label: 'Orders & Payment' },
    { id: 'returns-refunds', label: 'Returns & Refunds' },
    { id: 'intellectual-property', label: 'Intellectual Property' },
    { id: 'limitation-liability', label: 'Limitation of Liability' },
    { id: 'governing-law', label: 'Governing Law' },
    { id: 'changes', label: 'Changes to Terms' },
  ]

  const toc = isPrivacy ? privacyTOC : termsTOC

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
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
        <div className="mx-auto flex w-full max-w-5xl gap-8">
        {/* Sticky Table of Contents Sidebar */}
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="sticky top-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold text-white">Table of Contents</h2>
            <nav className="space-y-2">
              {toc.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="block w-full text-left text-xs text-slate-300 hover:text-primary transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold">
                {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Last updated: {new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <button
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
              onClick={() => navigate('/')}
            >
              Close
            </button>
          </div>

          {/* Mobile Table of Contents */}
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 lg:hidden">
            <h2 className="mb-3 text-sm font-semibold text-white">Table of Contents</h2>
            <nav className="space-y-2">
              {toc.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="block w-full text-left text-xs text-slate-300 hover:text-primary transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed">
            {isPrivacy ? (
              <>
                <section id="data-collected" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Data Collected</h2>
                  <p className="mb-4 text-slate-300">
                    We collect information that you provide directly to us, including:
                  </p>
                  <ul className="ml-6 list-disc space-y-2 text-slate-300">
                    <li>Name, email address, and phone number when you create an account or place an order</li>
                    <li>Shipping and billing addresses</li>
                    <li>Payment information (processed securely through our payment providers)</li>
                    <li>Order history and preferences</li>
                    <li>Communications with our customer service team</li>
                  </ul>
                  <p className="mt-4 text-slate-300">
                    We also automatically collect certain information when you visit our site, such as your IP address, browser type, device information, and usage patterns.
                  </p>
                </section>

                <section id="how-we-use" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">How We Use Your Data</h2>
                  <p className="mb-4 text-slate-300">
                    We use the information we collect to:
                  </p>
                  <ul className="ml-6 list-disc space-y-2 text-slate-300">
                    <li>Process and fulfill your orders</li>
                    <li>Send you order confirmations and shipping updates</li>
                    <li>Respond to your inquiries and provide customer support</li>
                    <li>Improve our website and services</li>
                    <li>Send you marketing communications (with your consent)</li>
                    <li>Detect and prevent fraud or abuse</li>
                    <li>Comply with legal obligations</li>
                  </ul>
                </section>

                <section id="data-sharing" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Data Sharing</h2>
                  <p className="mb-4 text-slate-300">
                    We do not sell your personal information. We may share your data with:
                  </p>
                  <ul className="ml-6 list-disc space-y-2 text-slate-300">
                    <li><strong>Service Providers:</strong> Third-party companies that help us operate our business (payment processors, shipping carriers, email service providers)</li>
                    <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                    <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                  </ul>
                  <p className="mt-4 text-slate-300">
                    All third parties are contractually obligated to protect your information and use it only for the purposes we specify.
                  </p>
                </section>

                <section id="data-security" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Data Security</h2>
                  <p className="mb-4 text-slate-300">
                    We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes:
                  </p>
                  <ul className="ml-6 list-disc space-y-2 text-slate-300">
                    <li>SSL encryption for data transmission</li>
                    <li>Secure storage of sensitive information</li>
                    <li>Regular security assessments and updates</li>
                    <li>Access controls and authentication</li>
                  </ul>
                  <p className="mt-4 text-slate-300">
                    However, no method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
                  </p>
                </section>

                <section id="your-rights" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Your Rights</h2>
                  <p className="mb-4 text-slate-300">
                    Depending on your location, you may have the following rights regarding your personal information:
                  </p>
                  <ul className="ml-6 list-disc space-y-2 text-slate-300">
                    <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                    <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
                    <li><strong>Deletion:</strong> Request deletion of your personal data</li>
                    <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                    <li><strong>Objection:</strong> Object to processing of your data for certain purposes</li>
                    <li><strong>Withdrawal of Consent:</strong> Withdraw consent where processing is based on consent</li>
                  </ul>
                  <p className="mt-4 text-slate-300">
                    To exercise these rights, please contact us using the information provided below.
                  </p>
                </section>

                <section id="cookies" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Cookies & Tracking</h2>
                  <p className="mb-4 text-slate-300">
                    We use cookies and similar tracking technologies to enhance your experience, analyze site usage, and assist with marketing efforts. You can control cookies through your browser settings, though this may affect site functionality.
                  </p>
                  <p className="text-slate-300">
                    Types of cookies we use:
                  </p>
                  <ul className="ml-6 list-disc space-y-2 text-slate-300">
                    <li><strong>Essential:</strong> Required for the site to function properly</li>
                    <li><strong>Analytics:</strong> Help us understand how visitors use our site</li>
                    <li><strong>Marketing:</strong> Used to deliver relevant advertisements</li>
                  </ul>
                </section>

                <section id="changes" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Policy Changes</h2>
                  <p className="text-slate-300">
                    We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date. We encourage you to review this policy periodically.
                  </p>
                </section>

                <section id="contact" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Contact Us</h2>
                  <p className="mb-4 text-slate-300">
                    If you have questions about this Privacy Policy or wish to exercise your rights, please contact us:
                  </p>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-slate-300">
                      <strong className="text-white">Email:</strong>{' '}
                      <a href={`mailto:${siteConfig.contact.email}`} className="text-primary hover:underline">
                        {siteConfig.contact.email}
                      </a>
                    </p>
                    <p className="mt-2 text-slate-300">
                      <strong className="text-white">Phone:</strong>{' '}
                      <a href={`tel:${siteConfig.contact.phone}`} className="text-primary hover:underline">
                        {siteConfig.contact.phone}
                      </a>
                    </p>
                    <p className="mt-2 text-slate-300">
                      <strong className="text-white">Address:</strong> {siteConfig.contact.location}
                    </p>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section id="acceptance" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Acceptance of Terms</h2>
                  <p className="text-slate-300">
                    By accessing and using {siteConfig.brandName}, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
                  </p>
                </section>

                <section id="use-of-service" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Use of Service</h2>
                  <p className="mb-4 text-slate-300">
                    You agree to use our service only for lawful purposes and in accordance with these Terms. You agree not to:
                  </p>
                  <ul className="ml-6 list-disc space-y-2 text-slate-300">
                    <li>Violate any applicable laws or regulations</li>
                    <li>Infringe upon the rights of others</li>
                    <li>Transmit any harmful, offensive, or illegal content</li>
                    <li>Attempt to gain unauthorized access to our systems</li>
                    <li>Interfere with or disrupt the service</li>
                    <li>Use automated systems to access the service without permission</li>
                  </ul>
                </section>

                <section id="user-accounts" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">User Accounts</h2>
                  <p className="mb-4 text-slate-300">
                    When you create an account, you are responsible for:
                  </p>
                  <ul className="ml-6 list-disc space-y-2 text-slate-300">
                    <li>Maintaining the confidentiality of your account credentials</li>
                    <li>All activities that occur under your account</li>
                    <li>Providing accurate and current information</li>
                    <li>Notifying us immediately of any unauthorized use</li>
                  </ul>
                  <p className="mt-4 text-slate-300">
                    We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.
                  </p>
                </section>

                <section id="products-pricing" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Products & Pricing</h2>
                  <p className="mb-4 text-slate-300">
                    We strive to provide accurate product descriptions, images, and pricing. However:
                  </p>
                  <ul className="ml-6 list-disc space-y-2 text-slate-300">
                    <li>Product availability is subject to change</li>
                    <li>Prices are subject to change without notice</li>
                    <li>We reserve the right to correct pricing errors</li>
                    <li>Product images are for illustrative purposes and may vary</li>
                    <li>We are not responsible for typographical errors</li>
                  </ul>
                  <p className="mt-4 text-slate-300">
                    If a product is mispriced, we may cancel your order and notify you of the cancellation.
                  </p>
                </section>

                <section id="orders-payment" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Orders & Payment</h2>
                  <p className="mb-4 text-slate-300">
                    When you place an order:
                  </p>
                  <ul className="ml-6 list-disc space-y-2 text-slate-300">
                    <li>You agree to provide accurate payment and shipping information</li>
                    <li>You authorize us to charge your payment method for the order total</li>
                    <li>We reserve the right to refuse or cancel any order</li>
                    <li>Order confirmation does not guarantee acceptance</li>
                    <li>We may require additional verification for certain orders</li>
                  </ul>
                  <p className="mt-4 text-slate-300">
                    Payment is processed securely through our payment providers. All prices are in USD unless otherwise stated.
                  </p>
                </section>

                <section id="returns-refunds" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Returns & Refunds</h2>
                  <p className="mb-4 text-slate-300">
                    Our return and refund policy is detailed in our Returns Policy. Key points:
                  </p>
                  <ul className="ml-6 list-disc space-y-2 text-slate-300">
                    <li>Returns must be initiated within 30 days of delivery</li>
                    <li>Items must be unused and in original packaging</li>
                    <li>Refunds will be processed to the original payment method</li>
                    <li>Shipping costs may be non-refundable</li>
                    <li>Some items may be non-returnable (final sale, personalized items)</li>
                  </ul>
                  <p className="mt-4 text-slate-300">
                    Please refer to our Returns Policy for complete details and instructions.
                  </p>
                </section>

                <section id="intellectual-property" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Intellectual Property</h2>
                  <p className="mb-4 text-slate-300">
                    All content on this website, including text, graphics, logos, images, and software, is the property of {siteConfig.brandName} or its licensors and is protected by copyright, trademark, and other intellectual property laws.
                  </p>
                  <p className="text-slate-300">
                    You may not reproduce, distribute, modify, or create derivative works from any content without our express written permission.
                  </p>
                </section>

                <section id="limitation-liability" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Limitation of Liability</h2>
                  <p className="mb-4 text-slate-300">
                    To the maximum extent permitted by law:
                  </p>
                  <ul className="ml-6 list-disc space-y-2 text-slate-300">
                    <li>We are not liable for any indirect, incidental, or consequential damages</li>
                    <li>Our total liability shall not exceed the amount you paid for the products</li>
                    <li>We are not responsible for delays or failures beyond our control</li>
                    <li>We do not guarantee uninterrupted or error-free service</li>
                  </ul>
                  <p className="mt-4 text-slate-300">
                    Some jurisdictions do not allow the exclusion of certain warranties or limitations of liability, so some of the above may not apply to you.
                  </p>
                </section>

                <section id="governing-law" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Governing Law</h2>
                  <p className="text-slate-300">
                    These Terms of Service are governed by and construed in accordance with the laws of the jurisdiction in which {siteConfig.brandName} operates, without regard to its conflict of law provisions.
                  </p>
                </section>

                <section id="changes" className="scroll-mt-8">
                  <h2 className="mb-4 text-2xl font-semibold text-white">Changes to Terms</h2>
                  <p className="text-slate-300">
                    We reserve the right to modify these Terms of Service at any time. We will notify users of material changes by posting the updated terms on this page and updating the "Last updated" date. Your continued use of the service after changes constitutes acceptance of the new terms.
                  </p>
                </section>
              </>
            )}
          </div>
        </div>
        </div>
      </main>

      <Footer
        orderTrackingEnabled={orderTrackingEnabled}
        onTrackOrder={onTrackOrder}
        onContactUs={onContactUs || (() => {})}
        onAboutUs={onAboutUs || (() => {})}
        onShippingReturns={onShippingReturns || (() => {})}
        onPrivacyPolicy={() => navigate('/privacy')}
        onTermsOfService={() => navigate('/terms')}
      />
    </div>
  )
}

