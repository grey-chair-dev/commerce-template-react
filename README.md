# Local Commerce Template (LCT) v2.0

A modern React e-commerce application that integrates with Square POS, Neon database, and real-time data adapters. The template features a full multi-page routing structure, authentication, product catalog, checkout flow, and user dashboard—all configurable through environment variables and feature flags.

## Features

- 🛍️ **Full E-commerce Flow**: Product catalog, detail pages, shopping cart, and multi-step checkout
- 🔐 **Authentication**: User sign-up, login, password recovery, and user dashboard
- 📦 **Order Management**: Order tracking, order lookup, and order confirmation pages
- 🔄 **Real-time Data**: WebSocket integration for live product updates with automatic fallback
- 🎨 **Customizable Branding**: Easy rebranding via CSS variables and configuration files
- 🚀 **Feature Flags**: Toggle features like wishlist, order tracking, maintenance mode, and more
- 📱 **Responsive Design**: Modern UI built with React, TypeScript, and Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Neon database instance (for production)
- Stack/Neon authentication credentials

### Installation

```bash
npm install
cp .env.example .env.local   # fill in Neon + Stack auth values
npm run dev
```

The application will be available at `http://localhost:5173` (or the port shown in your terminal).

### Environment Variables

**Required:**
- `VITE_NEON_AUTH_URL` – Neon Auth endpoint that issues Better Auth tokens
- `VITE_STACK_PROJECT_ID` – Stack/Neon project identifier passed to the auth adapter
- `VITE_STACK_PUBLISHABLE_CLIENT_KEY` – Publishable key for client bootstrap
- `VITE_APP_ID` – Application/tenant ID used when building the collection path

**Data Adapter:**
- `VITE_PRODUCTS_WS_URL` – WebSocket URL for real-time product updates (proxies `/artifacts/{appId}/public/data/products`)
- `VITE_PRODUCTS_SNAPSHOT_URL` – HTTPS endpoint for REST fallback when WebSocket is unavailable (accepts `:appId` or `{appId}` token replacement)
- `VITE_ADAPTER_HEALTH_URL` – Health check endpoint for the data adapter (polled every 30s)
- `VITE_ENABLE_MOCK_DATA` – Set to `true` to enable mock data (default) or `false` for real-time only

**WebSocket Configuration:**
- `VITE_WS_MAX_RETRIES` – Maximum reconnection attempts (default: 5)
- `VITE_WS_BACKOFF_BASE_MS` – Base delay for exponential backoff (default: 1000ms)
- `VITE_WS_BACKOFF_CAP_MS` – Maximum delay cap (default: 30000ms)
- `VITE_SNAPSHOT_POLL_INTERVAL_MS` – Polling interval in degraded mode (default: 30000ms)

**Monitoring (Optional):**
- `VITE_ERROR_WEBHOOK_URL` – HTTP endpoint for error reporting
- `VITE_METRICS_WEBHOOK_URL` – HTTP endpoint for metrics (latency, TTI)

**Feature Flags:**
- `VITE_ENABLE_WISHLIST` – Enable/disable wishlist feature (default: `true`)
- `VITE_ENABLE_ORDER_TRACKING` – Enable/disable order tracking (default: `true`)
- `VITE_ENABLE_MAINTENANCE_PAGE` – Enable maintenance mode (default: `false`)
- `VITE_ENABLE_COMING_SOON_PAGE` – Enable coming soon page (default: `false`)
- `VITE_ENABLE_SOCIAL_LINKS` – Enable social media links (default: `true`)
- `VITE_ENABLE_PROMO_BAR` – Enable promotional banner (default: `true`)
- `VITE_ENABLE_NEWSLETTER` – Enable newsletter signup (default: `true`)

**Runtime Injection:**
- `window.__app_id` and `window.__neon_auth_url` are automatically honored if provided by the hosting platform

## Configuration

### Branding & Content

All branding and content is configured in `src/config.ts`:

- **Site Configuration**: Brand name, tagline, hero section, contact info, social links
- **Feature Flags**: Toggle features like About page, Events, Maintenance mode, etc.
- **CSS Variables**: Customize colors in `src/globals.css`:
  - `--color-primary`
  - `--color-secondary`
  - `--color-accent`
  - `--color-surface`
  - `--color-text`

### Checkout Modes

Configure checkout delivery options:

```bash
npm run checkout:delivery    # Delivery only
npm run checkout:pickup       # Pickup only
npm run checkout:both         # Both delivery and pickup
```

## Architecture

### Routing

The application uses React Router for multi-page navigation with the following routes:

- `/` – Home page
- `/catalog` – Product catalog
- `/catalog/clearance` – Clearance items
- `/product/:id` – Product detail page
- `/checkout/shipping` – Checkout shipping step
- `/checkout/payment` – Checkout payment step
- `/checkout/review` – Checkout review step
- `/order/confirmation` – Order confirmation
- `/order/status/:id` – Order status page
- `/order/lookup` – Order lookup
- `/dashboard` – User dashboard
- `/login` – Login page
- `/signup` – Sign up page
- `/forgot-password` – Password recovery
- `/contact` – Contact page
- `/about` – About page
- `/faq` – FAQ page
- `/shipping-returns` – Shipping & returns
- `/privacy-terms` – Privacy & terms
- `/maintenance` – Maintenance page (if enabled)
- `/coming-soon` – Coming soon page (if enabled)

### Authentication

- **StackAuthProvider**: Wraps the app with Neon Auth adapter (Supabase-style)
- Supports initial auth token injection via `__initial_auth_token`
- User session management with automatic token refresh
- Protected routes for authenticated user areas

### Real-time Data

- **WebSocket Integration**: `subscribeToProducts()` connects to the data adapter via WebSocket
- **Automatic Fallback**: Falls back to REST snapshot or mock data if WebSocket fails
- **Health Monitoring**: Polls adapter health endpoint and displays status in UI
- **Exponential Backoff**: Automatic reconnection with configurable retry strategy

### Security

- **Input Sanitization**: All product data is sanitized via `sanitizeText()` before rendering
- **XSS Protection**: Strips HTML tags, script blocks, and non-printable characters
- **Client-side Hardening**: Even compromised upstream data remains display-only

### Monitoring & Resilience

- **Error Tracking**: Global error handlers capture and report client errors
- **Metrics Collection**: Tracks latency, TTI, and adapter health
- **Webhook Integration**: Optional error and metrics webhooks for observability
- **Cookie Consent**: User consent banner for analytics/monitoring

## Scripts

### Development

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Feature Management

```bash
npm run mock:add              # Enable mock data
npm run mock:delete           # Disable mock data (use real-time only)
npm run wishlist:add          # Enable wishlist feature
npm run wishlist:delete       # Disable wishlist feature
npm run order-tracking:add    # Enable order tracking
npm run order-tracking:delete # Disable order tracking
npm run maintenance:add       # Enable maintenance mode
npm run maintenance:delete    # Disable maintenance mode
```

## Testing Real-time Feed Locally

1. Leave `VITE_PRODUCTS_WS_URL` empty to enable the mock data emitter
2. Run `npm run dev`
3. Modify `src/dataAdapter.ts` mock data to simulate product updates
4. Observe the "Real-time adapter health" panel—latency should remain under 1s

When integrating with your actual adapter, ensure WebSocket payloads follow:
- `{ products: Product[] }` for bulk updates
- `{ product: Product }` for single product updates

## Project Structure

```
src/
├── components/          # React components
│   ├── Header.tsx      # Site header with navigation
│   ├── Footer.tsx      # Site footer
│   ├── CatalogPage.tsx # Product catalog
│   ├── ProductDetailPage.tsx
│   ├── Checkout*.tsx   # Checkout flow pages
│   ├── Order*.tsx      # Order management pages
│   └── ...
├── auth/               # Authentication
│   └── StackAuthProvider.tsx
├── config/             # Configuration
│   └── auth.ts
├── routes/             # Route configuration
│   └── RouteWrapper.tsx
├── utils/              # Utilities
│   └── sanitize.ts     # Input sanitization
├── config.ts           # Site configuration & feature flags
├── dataAdapter.ts      # Real-time data adapter
├── monitoring.ts       # Error tracking & metrics
├── formatters.ts       # Data formatters
└── App.tsx             # Main app component with routing
```

## Compliance & UX

- **Privacy & Terms**: Footer links pull from `siteConfig.legal.*` for easy policy updates
- **Cookie Consent**: Lightweight consent banner stores user preference in `localStorage` (`lct_cookie_consent`)
- **Accessibility**: Built with semantic HTML and ARIA best practices
- **Responsive**: Mobile-first design with Tailwind CSS

## License

[Add your license information here]
