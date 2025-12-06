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
  brandName: 'Spiral Groove Records',
  tagline: 'Vinyl, tapes, and turntable culture. Real-time stock from the bins.',
  hero: {
    headline: 'Analog sound for a digital city.',
    subheading:
      'From first pressings to dollar-bin gems, browse a live catalog that mirrors what is actually in the record crates—no guessing, no stale listings.',
    primaryCta: 'Browse Vinyl Catalog',
    secondaryCta: 'Visit the shop',
  },
  about: {
    heading: 'Independent, family-owned record store in downtown Milford',
    body: 'Spiral Groove Records is a nostalgic and eclectic shop specializing in new and used vinyl, cassettes, CDs, and audio equipment. Located in downtown Milford, we offer a true treasure for record shopping with good variety, friendly staff, and reasonable prices. We also buy vinyl—bring in your records!',
    highlights: [
      'New and used vinyl records, cassettes, CDs, and audio equipment',
      'We buy vinyl—bring in your collection',
      'Live inventory that mirrors what\'s actually in the bins',
    ],
  },
  events: [
    {
      title: 'Listening Room: Late Night Jazz',
      date: 'Fridays · 8–11 PM',
      description: 'Dim lights, full albums. Front-to-back plays of classic and modern jazz records on our in-store system.',
    },
    {
      title: 'In-Store Set & Signing',
      date: 'Monthly · Check the board',
      description: 'Live DJ or artist set, small-batch merch, and signed copies of limited runs while they last.',
    },
  ],
  contact: {
    phone: '(513) 600-8018',
    email: 'info@spiralgrooverecords.com',
    location: '215 B Main St., Milford, OH 45150',
    hours: 'Mon–Thu: 12pm–8pm · Fri–Sat: 12pm–9pm · Sun: 12pm–5pm',
  },
  legal: {
    privacyUrl: 'https://spiralgroove.local/privacy',
    termsUrl: 'https://spiralgroove.local/terms',
  },
  social: {
    facebook: 'https://facebook.com/spiralgrooverecords',
    instagram: 'https://instagram.com/spiral_groove_records_',
    twitter: 'https://www.tiktok.com/@spiral_groove',
  },
  promoBar: {
    enabled: true,
    message: 'New and used vinyl · We buy records · Located in downtown Milford',
  },
}

