# Square API Test Suite Documentation

This directory contains comprehensive tests for all Square-related functionality in the application.

## Test Files

### SDK Direct Tests
- `payments.test.js` - Tests Square Payments API SDK (5 test cases)
- `catalog.test.js` - Tests Square Catalog/Inventory API SDK (2 test cases)

### API Endpoint Tests
- `square-api.test.js` - Tests HTTP endpoints (`/api/square/products`, `/api/square/health`)

### Webhook Handler Tests
- `square-webhooks.test.js` - Tests webhook endpoints (order/payment, inventory, general)

### Monitoring Tests
- `square-monitoring.test.js` - Tests Square health monitoring endpoint

### Log Quality Tests
- `square-logs.test.js` - Tests log coherence, readability, and consistency

### Slack Alert Tests
- `square-slack-alerts.test.js` - Tests Slack alert message format and content (legacy webhook endpoint)
- `slack-alerter-service.test.js` - Tests centralized Slack alerting service with standard payload format (mocked)
- `slack-alerter-integration.test.js` - **Integration tests that send real messages to Slack** (requires SLACK_WEBHOOK_URL)

## Square Documentation References

All tests reference and validate against official Square API documentation:

### Core APIs
- **Payments API**: https://developer.squareup.com/reference/square/payments-api
- **Orders API**: https://developer.squareup.com/reference/square/orders-api
- **Catalog API**: https://developer.squareup.com/reference/square/catalog-api
- **Inventory API**: https://developer.squareup.com/reference/square/inventory-api
- **Refunds API**: https://developer.squareup.com/reference/square/refunds-api

### Webhooks
- **Webhook Overview**: https://developer.squareup.com/docs/webhooks/overview
- **Using Webhooks**: https://developer.squareup.com/docs/webhooks/using-webhooks
- **Signature Verification**: https://developer.squareup.com/docs/webhooks/step3verify
- **Webhook Events**: https://developer.squareup.com/reference/square/webhooks

### Testing & Development
- **Square Sandbox**: https://developer.squareup.com/docs/devtools/sandbox
- **Sandbox Payments**: https://developer.squareup.com/docs/devtools/sandbox/payments
- **Square Node.js SDK**: https://developer.squareup.com/docs/sdks/nodejs
- **API Explorer**: https://developer.squareup.com/docs/build-basics/using-rest-apis

### Custom Attributes
- **Custom Attributes API**: https://developer.squareup.com/reference/square/catalog-api/catalog-custom-attribute-definition

## How to Use Square Documentation

### Finding Relevant Documentation

1. **For API Endpoints**: Go to https://developer.squareup.com/reference/square and find the relevant API section
2. **For Webhook Events**: Check https://developer.squareup.com/docs/webhooks/using-webhooks for event structures
3. **For Error Codes**: Each API reference page includes error code documentation
4. **For Request/Response Formats**: Each endpoint documentation shows example requests and responses

### Using Square API Explorer

1. Go to https://developer.squareup.com/docs/build-basics/using-rest-apis
2. Select your application
3. Choose the API endpoint you want to test
4. Use the explorer to see actual request/response formats
5. Copy example payloads for use in tests

### Validating Test Data

When writing tests:
1. Check Square's API documentation for the exact request/response structure
2. Use Square's documented error codes in error handling tests
3. Reference Square's webhook payload examples for webhook tests
4. Use Square's test nonces from Sandbox documentation for payment tests

### Test Data Sources

- **Sandbox Test Cards**: https://developer.squareup.com/docs/devtools/sandbox/payments
- **Test Nonces**: Use `cnon:card-nonce-ok` and `cnon:card-nonce-declined` from Square docs
- **Webhook Payloads**: Reference Square's webhook event documentation for payload structures

## Running Tests

```bash
# Run all Square tests
npm run test:square

# Run tests with mocks (fast, no external API calls)
USE_MOCKS=true npm run test:square

# Run tests with real APIs (slower, but tests actual integration)
npm run test:square

# Run specific test suites
npm run test:payments
npm run test:catalog
npm run test:square-api
npm run test:square-webhooks
npm run test:square-monitoring
npm run test:square-logs
npm run test:square-slack

# Run all tests
npm test
```

## Test Configuration

Tests use `.env.test` for Square Sandbox credentials:
- `SQUARE_ACCESS_TOKEN` - Your Sandbox Access Token
- `SQUARE_LOCATION_ID` - Your Sandbox Location ID

Get these from: https://developer.squareup.com/apps

### Test Customer Setup

Tests automatically create and reuse a test customer in Square Sandbox for consistency. The test customer is created on first use and cached for subsequent tests.

**Test Customer Details:**
- Name: Test Customer
- Email: test.customer@example.com
- Phone: +15551234567
- Address: 123 Test Street, San Francisco, CA 94102

The test customer utility (`tests/utils/test-customer.js`) handles:
- Creating the customer if it doesn't exist
- Retrieving existing customer by email
- Caching customer ID for performance

**Square Customers API:**
- https://developer.squareup.com/reference/square/customers-api

## Test Utilities

- `square.client.js` - Square SDK client configuration
- `utils/http-test-helpers.js` - HTTP request testing utilities
- `utils/webhook-helpers.js` - Webhook payload generation (based on Square docs)
- `utils/square-docs-validator.js` - Response validation against Square schemas
- `utils/test-customer.js` - Test customer creation and management for Square Sandbox

## Key Test Scenarios

### Custom Attributes (Catalog API)
Tests verify that vinyl-specific custom attributes (Grading, Format) are present and correctly typed in product responses.

### Concurrency/Race Conditions (Inventory Webhook)
Tests simulate multiple inventory updates for the same item to ensure atomic transactions prevent over-selling.

### Refund Handling (Order/Payment Webhook)
Tests verify that refund events update order status to 'Refunded' or 'Partially Refunded' (not reverting to 'Pending').

### Log Quality
Tests ensure logs are coherent, readable, and include correlation IDs for debugging.

### Slack Alerts
Tests validate that Slack messages are properly formatted, include actionable steps, and reference Square Dashboard links.

