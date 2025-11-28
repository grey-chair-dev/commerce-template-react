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
  appId: import.meta.env.VITE_APP_ID ?? platformAppId ?? 'spiralgroove',
  brandName: 'Spiral Groove',
  tagline: 'Vinyl. Music. Community.',
  hero: {
    headline: 'Discover your next favorite record.',
    subheading:
      'Curated vinyl collection with real-time inventory. From rare finds to new releases, we keep the groove spinning.',
    primaryCta: 'Browse Records',
    secondaryCta: 'Visit the shop',
  },
  about: {
    heading: 'Your neighborhood record store',
    body: "Spiral Groove is more than a record store—it's a community hub for music lovers. We curate an ever-changing selection of vinyl, from classic albums to the latest releases, all with real-time inventory so you always know what's in stock.",
    highlights: [
      'Curated selection of new and vintage vinyl',
      'Real-time inventory updates',
      'Community events and listening sessions',
    ],
  },
  events: [
    {
      title: 'New Arrivals Listening Party',
      date: 'First Friday of each month · 7–10 PM',
      description: 'Join us for an evening of new releases, refreshments, and great music.',
    },
    {
      title: 'Vinyl Swap Meet',
      date: 'Third Saturday · 12–4 PM',
      description: 'Bring your records to trade, buy, or sell. Connect with fellow collectors.',
    },
  ],
  contact: {
    phone: '(555) 123-4567',
    email: 'hello@spiralgroove.com',
    location: '123 Music Street, Your City, ST 12345',
    hours: 'Mon–Sat 10a – 8p · Sun 12p – 6p',
  },
  legal: {
    privacyUrl: 'https://spiralgroove.com/privacy',
    termsUrl: 'https://spiralgroove.com/terms',
  },
  social: {
    facebook: 'https://facebook.com/spiralgroove',
    instagram: 'https://instagram.com/spiralgroove',
    twitter: 'https://twitter.com/spiralgroove',
  },
  promoBar: {
    enabled: true,
    message: 'Free shipping on orders over $50 · New arrivals every week',
  },
}

