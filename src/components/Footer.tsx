import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { siteConfig, featureFlags } from '../config'

type FooterProps = {
  orderTrackingEnabled: boolean
  onTrackOrder: () => void
  onContactUs: () => void
  onAboutUs?: () => void
  onShippingReturns?: () => void
  onPrivacyPolicy?: () => void
  onTermsOfService?: () => void
}

export function Footer({
  orderTrackingEnabled,
  onTrackOrder,
  onContactUs,
  onAboutUs,
  onShippingReturns,
  onPrivacyPolicy,
  onTermsOfService,
}: FooterProps) {
  const navigate = useNavigate()
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false)

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newsletterEmail.trim()) {
      // Store in localStorage for demo purposes
      const existing = JSON.parse(localStorage.getItem('newsletter_subscribers') || '[]')
      existing.push({ email: newsletterEmail, date: new Date().toISOString() })
      localStorage.setItem('newsletter_subscribers', JSON.stringify(existing))
      setNewsletterSubmitted(true)
      setNewsletterEmail('')
      setTimeout(() => setNewsletterSubmitted(false), 3000)
    }
  }

  return (
    <footer className="w-full border-t border-white/10 bg-surface/70 px-4 py-6 sm:px-6 text-xs text-slate-400">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {/* Left Column - Branding */}
          <div className="space-y-4">
          <div>
              <h3 className="mb-2 text-base font-semibold text-white">{siteConfig.brandName}</h3>
              <p className="text-sm text-slate-400">{siteConfig.tagline}</p>
          </div>
          
          {/* Social Links */}
          {featureFlags.enableSocialLinks && (siteConfig.social?.facebook || siteConfig.social?.instagram || siteConfig.social?.twitter) && (
              <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white">Follow Us</h4>
                <div className="flex gap-3">
                {siteConfig.social.facebook && (
                  <a
                    href={siteConfig.social.facebook}
                    target="_blank"
                    rel="noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 hover:border-primary hover:text-primary transition-colors"
                    aria-label="Facebook"
                  >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                )}
                {siteConfig.social.instagram && (
                  <a
                    href={siteConfig.social.instagram}
                    target="_blank"
                    rel="noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 hover:border-primary hover:text-primary transition-colors"
                    aria-label="Instagram"
                  >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.98-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.98-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                )}
                {siteConfig.social.twitter && (
                  <a
                    href={siteConfig.social.twitter}
                    target="_blank"
                    rel="noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 hover:border-primary hover:text-primary transition-colors"
                    aria-label="Twitter"
                  >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>
          )}

            <div className="text-xs text-slate-500 space-y-1">
            <p>App ID: {siteConfig.appId}</p>
            <p>Built for Neon + Square</p>
          </div>
        </div>

        {/* Middle Column - Quick Links */}
        <div className="space-y-3">
            <h3 className="text-base font-semibold text-white">Quick Links</h3>
          <div className="flex flex-col gap-2">
            {orderTrackingEnabled && (
              <button
                onClick={onTrackOrder}
                  className="text-left text-sm text-white/80 hover:text-white py-2 min-h-[44px] flex items-center"
              >
                Track Order
              </button>
            )}
              <button 
                onClick={onContactUs} 
                className="text-left text-sm text-white/80 hover:text-white py-2 min-h-[44px] flex items-center"
              >
              Contact Us
            </button>
            {onAboutUs && (
                <button 
                  onClick={onAboutUs} 
                  className="text-left text-sm text-white/80 hover:text-white py-2 min-h-[44px] flex items-center"
                >
                About Us
              </button>
            )}
            {onShippingReturns && (
              <button
                onClick={onShippingReturns}
                  className="text-left text-sm text-white/80 hover:text-white py-2 min-h-[44px] flex items-center"
              >
                {(() => {
                  const checkoutMode = (import.meta.env.VITE_CHECKOUT_MODE ?? 'both').toString().toLowerCase()
                  return checkoutMode === 'pickup' ? 'Returns' : 'Shipping & Returns'
                })()}
              </button>
            )}
            <button
              onClick={() => navigate('/faq')}
                className="text-left text-sm text-white/80 hover:text-white py-2 min-h-[44px] flex items-center"
            >
              FAQs
            </button>
          </div>
        </div>

        {/* Right Column - Contact Info */}
        <div className="space-y-3">
            <h3 className="text-base font-semibold text-white">Contact</h3>
            <div className="space-y-2 text-sm">
            <a
              href={`tel:${siteConfig.contact.phone}`}
                className="block text-white/80 hover:text-white py-2 min-h-[44px] flex items-center"
            >
              {siteConfig.contact.phone}
            </a>
            <a
              href={`mailto:${siteConfig.contact.email}`}
                className="block text-white/80 hover:text-white py-2 min-h-[44px] flex items-center"
            >
              {siteConfig.contact.email}
            </a>
            <p className="text-slate-500">{siteConfig.contact.location}</p>
            <p className="text-slate-500">{siteConfig.contact.hours}</p>
            </div>
          </div>
          
          {/* Newsletter Column */}
          {featureFlags.enableNewsletter && (
            <div className="space-y-3">
              <h4 className="text-base font-semibold text-white">Newsletter</h4>
              <p className="text-sm text-slate-400">Get updates on new products and special offers</p>
              <form onSubmit={handleNewsletterSubmit} className="space-y-2">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Your email"
                  className="w-full rounded-full border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none min-h-[44px]"
                  required
                />
                <button
                  type="submit"
                  className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand hover:bg-primary/80 min-h-[44px]"
                >
                  Subscribe
                </button>
              </form>
              {newsletterSubmitted && (
                <p className="text-sm text-accent">Thanks for subscribing!</p>
              )}
            </div>
          )}
      </div>

      {/* Bottom Bar */}
        <div className="mt-8 border-t border-white/10 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-slate-500">
              © {new Date().getFullYear()} {siteConfig.brandName}. All rights reserved.
            </span>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              {onPrivacyPolicy ? (
                <button
                  onClick={() => {
                    onPrivacyPolicy()
                    navigate('/privacy')
                  }}
                  className="hover:text-white transition-colors py-2 min-h-[44px] flex items-center"
                >
                  Privacy Policy
                </button>
              ) : (
                <a
                  href={siteConfig.legal.privacyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors py-2 min-h-[44px] flex items-center"
                >
                  Privacy Policy
                </a>
              )}
              {onTermsOfService ? (
                <button
                  onClick={() => {
                    onTermsOfService()
                    navigate('/terms')
                  }}
                  className="hover:text-white transition-colors py-2 min-h-[44px] flex items-center"
                >
                  Terms of Service
                </button>
              ) : (
                <a
                  href={siteConfig.legal.termsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors py-2 min-h-[44px] flex items-center"
                >
                  Terms of Service
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

