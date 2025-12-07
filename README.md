# Commerce Template React

A modern, full-featured e-commerce platform built with React, Vite, and Square API integration. Features secure customer authentication, real-time inventory management, order processing, and comprehensive monitoring.

## 🚀 Features

### Core E-Commerce
- **Product Catalog**: Real-time product listings with Square API integration
- **Shopping Cart**: Persistent cart with local storage and database sync
- **Checkout Flow**: Secure checkout with Square payment processing
- **Order Management**: Order tracking, confirmation, and history
- **Pickup-Only Orders**: Streamlined pickup experience (no shipping)

### Authentication & Security
- **Email/Password Authentication**: Secure JWT-based authentication with bcrypt password hashing
- **HTTP-Only Cookies**: XSS-protected session management
- **Guest Checkout**: Support for both authenticated and guest orders
- **Account Management**: User profiles with order history

### Inventory Management
- **Real-Time Sync**: Square webhook integration for inventory updates
- **Stock Tracking**: Automatic stock count management
- **Inventory Auditing**: Complete audit trail of inventory changes

### Monitoring & Alerts
- **Comprehensive Monitoring**: 9 monitoring endpoints tracking system health
- **Slack Integration**: Real-time alerts with actionable steps
- **Automated Health Checks**: Daily cron jobs for proactive monitoring
- **Error Tracking**: Detailed error logging with Error IDs

## 📋 Prerequisites

- Node.js 18+ and npm
- Neon PostgreSQL database
- Square Developer account with API credentials
- Slack workspace (for monitoring alerts)
- Vercel account (for deployment)

## 🛠️ Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd commerce-template-react
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database
SPR_DATABASE_URL=postgresql://user:password@host/database

# Square API
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_LOCATION_ID=your_location_id
SQUARE_ENVIRONMENT=sandbox
SQUARE_SIGNATURE_KEY=your_webhook_signature_key

# Authentication
JWT_SECRET=your_jwt_secret_key

# Slack (for monitoring alerts)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Email Service Provider (optional - choose one)
SENDGRID_API_KEY=your_sendgrid_key
# OR
MAILGUN_API_KEY=your_mailgun_key
MAILGUN_DOMAIN=your_mailgun_domain
# OR
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
# OR
RESEND_API_KEY=your_resend_key

# Site URL (for production)
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 3. Database Setup

Run the database schema:

```bash
# Connect to your Neon database and run:
psql $SPR_DATABASE_URL -f neon-schema.sql
```

Create the auth logs table for authentication monitoring:

```bash
node scripts/create-auth-logs-table.js
```

### 4. Generate JWT Secret

```bash
npm run generate-jwt-secret
```

Copy the output to `JWT_SECRET` in `.env.local` and Vercel environment variables.

### 5. Development

Start the Vercel dev server:

```bash
vercel dev
```

The app will be available at `http://localhost:5173` (frontend) and `http://localhost:3000` (API).

## 📊 Monitoring System

### Overview

The application includes a comprehensive monitoring system with 9 monitoring endpoints that track system health, performance, and business metrics. All alerts are sent to Slack with specific, actionable steps.

### Monitoring Endpoints

#### 1. **Webhook Error Alerts** (`/api/webhooks/slack-alert`)
- **5xx Errors on `/api/webhooks/square-order-paid`**: Alerts when paid orders fail to be recorded
  - **Action**: Manual order insertion into Neon database
- **5xx Errors on `/api/webhooks/square-inventory`**: Alerts when inventory updates fail
  - **Action**: Manual SKU stock count fix
- **403 Errors**: Alerts on webhook signature verification failures
  - **Action**: Verify and update `SQUARE_SIGNATURE_KEY`

#### 2. **Inventory Divergence Check** (`/api/monitoring/inventory-sync-check`)
- **Metric**: Compares Square inventory with Neon database
- **Alert**: Mismatches ≥5 units
- **Action**: Code audit + full catalog/inventory resync
- **Schedule**: Daily at 3 AM EST

#### 3. **Neon Database Health** (`/api/monitoring/neon-health`)
- **Connection Pool Usage**: Alerts when >80%
  - **Action**: Scale up compute/connection limit + code audit
- **Query Latency**: Alerts when SELECT queries >100ms
  - **Action**: Add indexes + optimize queries
- **Schedule**: Daily at 3 AM EST

#### 4. **Cart Abandonment Rate** (`/api/monitoring/cart-abandonment`)
- **Metric**: Ratio of carts started to transactions completed
- **Alert**: Rate increases by 15% within 24 hours
- **Action**: UX audit + log review
- **Schedule**: Daily at 3 AM EST

#### 5. **Authentication Failure Rate** (`/api/monitoring/auth-failure-rate`)
- **Metric**: Ratio of successful to failed logins
- **Alert**: Failure rate exceeds 3%
- **Action**: Verify `JWT_SECRET` + test bcrypt logic
- **Schedule**: Daily at 3 AM EST
- **Requires**: `auth_logs` table (created via `scripts/create-auth-logs-table.js`)

#### 6. **Square API Health** (`/api/monitoring/square-health`)
- **Checks**: Square status page + direct API connectivity
- **Alert**: Outages or degraded performance
- **Action**: Display proactive site banner + check status page
- **Schedule**: Daily at 3 AM EST

#### 7. **Email Service Provider Health** (`/api/monitoring/esp-health`)
- **Checks**: ESP status page + direct API connectivity
- **Alert**: Outages or API failures
- **Action**: Display proactive banner + manual customer notification
- **Schedule**: Daily at 3 AM EST

### Testing Monitoring Alerts

Test all monitoring endpoints:

```bash
node scripts/test-all-monitoring-alerts.js
```

This will send test alerts to your Slack channel, verifying that all endpoints work correctly and include the expected actionable steps.

### Manual Health Checks

You can manually trigger any monitoring check:

```bash
# GET request (check status without alert)
curl http://localhost:3000/api/monitoring/neon-health

# POST request (check status and send alert if threshold breached)
curl -X POST http://localhost:3000/api/monitoring/neon-health
```

### Debug Endpoint

View monitoring system status and test connections:

```bash
curl http://localhost:3000/api/monitoring/debug
```

## 🧪 Testing

### Automated Test Suites

The application includes comprehensive automated test suites:

#### Inventory Tests (`scripts/test-inventory-sync.js`)
- **I-101**: Catalog sync verification
- **I-102**: Real-time inventory sync
- **I-103**: Zero stock logic
- **I-104**: Stock limit validation

```bash
node scripts/test-inventory-sync.js
```

#### Authentication Tests (`scripts/test-auth-security.js`)
- **A-201**: User registration with password hashing
- **A-202**: Login and session management
- **A-203**: JWT security validation
- **A-204**: Checkout login flow

```bash
node scripts/test-auth-security.js
```

#### Checkout Tests (`scripts/test-checkout-orders.js`)
- **C-301**: Checkout data integrity
- **C-302**: Full transaction flow (manual)
- **C-303**: Webhook order recording
- **C-304**: Order history and data separation
- **C-305**: Fulfillment status verification

```bash
node scripts/test-checkout-orders.js
```

#### Monitoring Tests (`scripts/test-all-monitoring-alerts.js`)
- Tests all 9 monitoring endpoints
- Verifies Slack alert delivery
- Validates actionable steps in alerts

```bash
node scripts/test-all-monitoring-alerts.js
```

## 📁 Project Structure

```
commerce-template-react/
├── api/                          # Vercel serverless functions
│   ├── auth/                     # Authentication endpoints
│   │   ├── register.js
│   │   ├── login.js
│   │   ├── logout.js
│   │   └── me.js
│   ├── checkout/                 # Checkout endpoints
│   │   └── create.js
│   ├── monitoring/                # Monitoring endpoints
│   │   ├── neon-health.js
│   │   ├── inventory-sync-check.js
│   │   ├── cart-abandonment.js
│   │   ├── auth-failure-rate.js
│   │   ├── square-health.js
│   │   ├── esp-health.js
│   │   └── debug.js
│   ├── webhooks/                  # Webhook handlers
│   │   ├── square-inventory.js
│   │   ├── square-order-paid.js
│   │   └── slack-alert.js
│   └── middleware/                # Shared middleware
│       └── auth.js
├── src/                           # React frontend
│   ├── components/                # React components
│   ├── auth/                     # Authentication providers
│   └── App.tsx                   # Main app component
├── scripts/                       # Utility scripts
│   ├── test-*.js                 # Test suites
│   ├── create-auth-logs-table.js
│   └── generate-jwt-secret.js
├── neon-schema.sql               # Database schema
├── vercel.json                   # Vercel configuration
└── package.json
```

## 🚢 Deployment

### Vercel Deployment

1. **Connect Repository**: Link your GitHub repository to Vercel

2. **Set Environment Variables**: Add all variables from `.env.local` to Vercel Dashboard:
   - Go to Project Settings → Environment Variables
   - Add each variable for Production, Preview, and Development environments

3. **Deploy**:
   ```bash
   vercel --prod
   ```

4. **Configure Square Webhooks**: 
   - In Square Developer Dashboard, set webhook URLs:
     - `https://your-domain.vercel.app/api/webhooks/square-inventory`
     - `https://your-domain.vercel.app/api/webhooks/square-order-paid`
   - Copy the webhook signature key to `SQUARE_SIGNATURE_KEY`

5. **Verify Cron Jobs**: 
   - Cron jobs are configured in `vercel.json`
   - All monitoring checks run daily at 3 AM EST
   - Verify in Vercel Dashboard → Cron Jobs

## 🔒 Security

### Authentication
- Passwords are hashed with bcrypt (10 rounds)
- JWT tokens stored in HTTP-only cookies
- SameSite=Strict in production (CSRF protection)
- Secure flag enabled in production (HTTPS only)

### Environment Variables
- Never commit `.env.local` to version control
- Use Vercel Dashboard for production secrets
- Rotate `JWT_SECRET` periodically

### Webhook Security
- Square webhook signature verification
- IP whitelisting (via Vercel)
- Error logging with Error IDs for tracking

## 📚 Documentation

- **Security Setup**: See `SECURITY_SETUP.md` for JWT configuration
- **Square Test Cards**: See `SQUARE_SANDBOX_TEST_CARDS.md` for testing payments
- **Browser HSTS Fix**: See `BROWSER_HSTS_FIX.md` for localhost HTTPS issues

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run test suites to verify functionality
4. Submit a pull request

## 📝 License

[Your License Here]

## 🆘 Support

For issues or questions:
1. Check the monitoring debug endpoint: `/api/monitoring/debug`
2. Review Vercel logs for Error IDs
3. Check Slack alerts for actionable steps
4. Review test suite outputs for specific failures

---

**Built for Spiral Groove Records by Grey Chair Digital**

Built with ❤️ using React, Vite, Square API, Neon PostgreSQL, and Vercel
