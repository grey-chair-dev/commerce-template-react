export type FeatureFlags = {
  enableAbout: boolean
  enableEvents: boolean
  enableMaintenancePage: boolean
  enableComingSoonPage: boolean
  enableSocialLinks: boolean
  enablePromoBar: boolean
  enableNewsletter: boolean
}

const maintenancePageEnabled =
  (import.meta.env.VITE_ENABLE_MAINTENANCE_PAGE ?? 'false').toString().toLowerCase() === 'true'

const comingSoonPageEnabled =
  (import.meta.env.VITE_ENABLE_COMING_SOON_PAGE ?? 'false').toString().toLowerCase() === 'true'

const socialLinksEnabled =
  (import.meta.env.VITE_ENABLE_SOCIAL_LINKS ?? 'true').toString().toLowerCase() !== 'false'

const promoBarEnabled =
  (import.meta.env.VITE_ENABLE_PROMO_BAR ?? 'true').toString().toLowerCase() !== 'false'

const newsletterEnabled =
  (import.meta.env.VITE_ENABLE_NEWSLETTER ?? 'true').toString().toLowerCase() !== 'false'

export const featureFlags: FeatureFlags = {
  enableAbout: true,
  enableEvents: true,
  enableMaintenancePage: maintenancePageEnabled,
  enableComingSoonPage: comingSoonPageEnabled,
  enableSocialLinks: socialLinksEnabled,
  enablePromoBar: promoBarEnabled,
  enableNewsletter: newsletterEnabled,
}

export type SiteConfig = {
  appId: string
  brandName: string
  tagline: string
  hero: {
    headline: string
    subheading: string
    primaryCta: string
    secondaryCta: string
  }
  about: {
    heading: string
    body: string
    highlights: string[]
  }
  events: {
    title: string
    date: string
    description: string
  }[]
  contact: {
    phone: string
    email: string
    location: string
    hours: string
  }
  legal: {
    privacyUrl: string
    termsUrl: string
  }
  social: {
    facebook?: string
    instagram?: string
    twitter?: string
    linkedin?: string
  }
  promoBar?: {
    enabled: boolean
    message: string
  }
}

const platformAppId =
  typeof window === 'undefined'
    ? undefined
    : (window as Window & { __app_id?: string }).__app_id

export const siteConfig: SiteConfig = {
  appId: import.meta.env.VITE_APP_ID ?? platformAppId ?? 'demo-local-commerce',
  brandName: 'Harbor Market Collective',
  tagline: 'Local goods. Local stories. Real-time availability.',
  hero: {
    headline: 'Local commerce that feels alive.',
    subheading:
      'Square POS stays the origin, Neon mirrors the truth, and customers always see the latest product data.',
    primaryCta: 'Browse Live Catalog',
    secondaryCta: 'Talk to the team',
  },
  about: {
    heading: 'Neighborhood-first retail',
    body: 'The Local Commerce Template is tuned for makers and merchants that need premium digital shelves without the enterprise lift. It pulls product truth from Neon, caches responsibly with Upstash, and keeps the UI feather-light.',
    highlights: [
      'Branding swap in minutes via CSS vars',
      'Real-time catalog powered by mandated data adapter',
      'No routing, just orchestrated sections via config',
    ],
  },
  events: [
    {
      title: 'First Friday Pop-up',
      date: 'Dec 5 · 5–9 PM',
      description: 'Live screen-printing, seasonal coffee flight, and vendor collabs.',
    },
    {
      title: 'Makers Studio Hours',
      date: 'Dec 12 · 2–6 PM',
      description: 'Drop-in coaching with resident makers + Square POS onboarding clinic.',
    },
  ],
  contact: {
    phone: '(415) 555-0112',
    email: 'hello@harbormarket.local',
    location: '118 Grove St, San Francisco, CA',
    hours: 'Open daily · 8a – 8p',
  },
  legal: {
    privacyUrl: 'https://commerce.local/privacy',
    termsUrl: 'https://commerce.local/terms',
  },
  social: {
    facebook: 'https://facebook.com/harbormarket',
    instagram: 'https://instagram.com/harbormarket',
    twitter: 'https://twitter.com/harbormarket',
  },
  promoBar: {
    enabled: true,
    message: 'Free shipping on orders over $50 · New arrivals every week',
  },
}

