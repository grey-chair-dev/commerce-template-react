/**
 * Jest Setup File for API Mocking
 * 
 * Configures Nock to intercept and mock all external HTTP requests
 * during tests to speed up execution and eliminate dependency on external services.
 * 
 * This file is automatically loaded by Jest via setupFilesAfterEnv in jest.config.cjs
 */

import nock from 'nock';
import { afterEach, afterAll } from '@jest/globals';

// Check if mocking is enabled
const USE_MOCKS = process.env.USE_MOCKS === 'true' || process.env.USE_MOCKS === '1';

if (USE_MOCKS) {
  // Enable Nock to intercept requests when mocking is enabled
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1'); // Allow localhost
  nock.enableNetConnect('localhost'); // Allow localhost
} else {
  // When not using mocks, allow all network connections
  console.log('⚠️  HTTP mocking disabled - tests will use real APIs');
  console.log('   Set USE_MOCKS=true to enable mocking for faster tests');
}

// Clean up after each test
afterEach(() => {
  nock.cleanAll();
});

// Clean up after all tests
afterAll(() => {
  nock.restore();
  nock.enableNetConnect();
});

/**
 * Square API Mocks
 * 
 * Mocks Square API endpoints for both production and sandbox environments.
 * The Square SDK makes requests to connect.squareup.com (production) or
 * connect.squareupsandbox.com (sandbox).
 */
export function mockSquareAPI() {
  const squareBaseUrls = [
    'https://connect.squareup.com',
    'https://connect.squareupsandbox.com',
  ];

  squareBaseUrls.forEach(baseUrl => {
    // Mock Square Catalog API - Search Catalog (POST /v2/catalog/search)
    nock(baseUrl)
      .persist()
      .post('/v2/catalog/search')
      .reply(200, {
        objects: [
          {
            id: 'ITEM_TEST_123',
            type: 'ITEM',
            itemData: {
              name: 'Test Vinyl Record',
              description: 'A test vinyl record for unit testing',
              variations: [
                {
                  id: 'VARIATION_TEST_123',
                  type: 'ITEM_VARIATION',
                  itemVariationData: {
                    name: 'Default',
                    pricingType: 'FIXED_PRICING',
                    priceMoney: {
                      amount: 2500,
                      currency: 'USD',
                    },
                  },
                },
              ],
              customAttributeValues: [
                {
                  name: 'Grading',
                  value: 'VG+',
                  type: 'STRING',
                },
                {
                  name: 'Format',
                  value: 'LP',
                  type: 'STRING',
                },
              ],
            },
          },
        ],
        cursor: null,
      });

    // Mock Square Inventory API - Batch Retrieve Counts
    nock(baseUrl)
      .persist()
      .post('/v2/inventory/counts/batch-retrieve')
      .reply(200, {
        counts: [
          {
            catalogObjectId: 'VARIATION_TEST_123',
            catalogObjectType: 'ITEM_VARIATION',
            state: 'IN_STOCK',
            locationId: 'LOCATION_TEST',
            quantity: '5',
          },
        ],
        cursor: null,
      });

    // Mock Square Payments API - Create Payment
    nock(baseUrl)
      .persist()
      .post('/v2/payments')
      .reply(200, {
        payment: {
          id: 'PAYMENT_TEST_123',
          status: 'COMPLETED',
          amountMoney: {
            amount: 2500,
            currency: 'USD',
          },
          sourceType: 'CARD',
          cardDetails: {
            status: 'CAPTURED',
            card: {
              cardBrand: 'VISA',
              last4: '1234',
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

    // Mock Square Payments API - Payment declined
    nock(baseUrl)
      .post('/v2/payments')
      .reply(400, {
        errors: [
          {
            category: 'PAYMENT_METHOD_ERROR',
            code: 'CARD_DECLINED',
            detail: 'Card was declined.',
          },
        ],
      });

    // Mock Square Customers API - Create Customer
    nock(baseUrl)
      .persist()
      .post('/v2/customers')
      .reply(200, {
        customer: {
          id: 'CUSTOMER_TEST_123',
          givenName: 'Test',
          familyName: 'Customer',
          emailAddress: 'test@example.com',
          phoneNumber: '+15551234567',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

    // Mock Square Customers API - Search Customers
    nock(baseUrl)
      .persist()
      .post('/v2/customers/search')
      .reply(200, {
        customers: [
          {
            id: 'CUSTOMER_TEST_123',
            givenName: 'Test',
            familyName: 'Customer',
            emailAddress: 'test@example.com',
          },
        ],
        cursor: null,
      });

    // Mock Square Orders API - Create Order
    nock(baseUrl)
      .persist()
      .post('/v2/orders')
      .reply(200, {
        order: {
          id: 'ORDER_TEST_123',
          locationId: 'LOCATION_TEST',
          state: 'OPEN',
          lineItems: [
            {
              uid: 'line_item_1',
              name: 'Test Item',
              quantity: '1',
              basePriceMoney: {
                amount: 2500,
                currency: 'USD',
              },
            },
          ],
          netAmounts: {
            totalMoney: {
              amount: 2500,
              currency: 'USD',
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

    // Mock Square Refunds API - Refund Payment
    nock(baseUrl)
      .persist()
      .post('/v2/refunds')
      .reply(200, {
        refund: {
          id: 'REFUND_TEST_123',
          status: 'COMPLETED',
          amountMoney: {
            amount: 2500,
            currency: 'USD',
          },
          paymentId: 'PAYMENT_TEST_123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

    // Mock Square Checkout API - Create Payment Link
    nock(baseUrl)
      .persist()
      .post('/v2/checkout/links')
      .reply(200, {
        paymentLink: {
          id: 'PAYMENT_LINK_TEST_123',
          version: 1,
          url: 'https://square.link/test-checkout',
          orderId: 'ORDER_TEST_123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
  });

  // Mock Square Status Page
  nock('https://status.squareup.com')
    .persist()
    .get('/api/v2/status.json')
    .reply(200, {
      status: {
        indicator: 'none',
        description: 'All Systems Operational',
      },
      page: {
        id: 'square',
        name: 'Square',
        url: 'https://status.squareup.com',
        timeZone: 'America/Los_Angeles',
        updatedAt: new Date().toISOString(),
      },
      incidents: [],
      scheduledMaintenances: [],
    });

  // Mock Square Status Page - With incidents
  nock('https://status.squareup.com')
    .get('/api/v2/status.json')
    .reply(200, {
      status: {
        indicator: 'major',
        description: 'Major Service Outage',
      },
      incidents: [
        {
          id: 'incident_123',
          name: 'API Degradation',
          status: 'investigating',
          impact: 'major',
          created_at: new Date().toISOString(),
        },
      ],
    });
}

/**
 * Make.com Webhook Mocks
 * 
 * Mocks Make.com webhook endpoints. Make.com webhooks can be at:
 * - hook.us.make.com (US region)
 * - hook.eu.make.com (EU region)
 * - Custom domains
 */
export function mockMakeComWebhooks() {
  // Mock Make.com webhook - US region
  nock('https://hook.us.make.com')
    .persist()
    .post(/.*/)
    .reply(200, {
      success: true,
      message: 'Webhook processed successfully',
    });

  // Mock Make.com webhook - EU region
  nock('https://hook.eu.make.com')
    .persist()
    .post(/.*/)
    .reply(200, {
      success: true,
      message: 'Webhook processed successfully',
    });

  // Mock Make.com webhook - Generic pattern (any Make.com webhook)
  nock(/https:\/\/hook\.[a-z]+\.make\.com/)
    .persist()
    .post(/.*/)
    .reply(200, {
      success: true,
      message: 'Webhook processed successfully',
    });

  // Mock Make.com webhook - Error response (for error testing)
  nock(/https:\/\/hook\.[a-z]+\.make\.com/)
    .post(/.*/)
    .reply(500, {
      error: 'Internal server error',
    });
}

/**
 * Discogs API Mocks
 */
export function mockDiscogsAPI() {
  const discogsBaseUrl = 'https://api.discogs.com';

  // Mock Discogs API - Search
  nock(discogsBaseUrl)
    .persist()
    .get(/\/database\/search/)
    .query(true)
    .reply(200, {
      pagination: {
        page: 1,
        pages: 1,
        per_page: 50,
        items: 1,
        urls: {},
      },
      results: [
        {
          id: 12345,
          type: 'release',
          title: 'Test Album',
          year: 2020,
          thumb: 'https://example.com/thumb.jpg',
          cover_image: 'https://example.com/cover.jpg',
          master_id: 67890,
          master_url: 'https://api.discogs.com/masters/67890',
          uri: 'https://api.discogs.com/releases/12345',
          resource_url: 'https://api.discogs.com/releases/12345',
        },
      ],
    });

  // Mock Discogs API - Get Release
  nock(discogsBaseUrl)
    .persist()
    .get(/\/releases\/\d+/)
    .reply(200, {
      id: 12345,
      title: 'Test Album',
      artists: [
        {
          name: 'Test Artist',
        },
      ],
      year: 2020,
      genres: ['Rock'],
      styles: ['Alternative'],
      tracklist: [
        {
          position: '1',
          title: 'Test Track',
          duration: '3:45',
        },
      ],
      images: [
        {
          type: 'primary',
          uri: 'https://example.com/cover.jpg',
          resource_url: 'https://example.com/cover.jpg',
        },
      ],
    });

  // Mock Discogs API - Get Master
  nock(discogsBaseUrl)
    .persist()
    .get(/\/masters\/\d+/)
    .reply(200, {
      id: 67890,
      title: 'Test Album',
      artists: [
        {
          name: 'Test Artist',
        },
      ],
      year: 2020,
      genres: ['Rock'],
      styles: ['Alternative'],
      main_release: 12345,
      versions_url: 'https://api.discogs.com/masters/67890/versions',
    });
}

/**
 * Setup all mocks
 */
export function setupAllMocks() {
  if (!USE_MOCKS) {
    return; // Skip mocking if disabled
  }

  console.log('🔧 Setting up HTTP mocks for faster tests...');
  
  // Setup HTTP mocks for external services
  mockMakeComWebhooks();
  mockDiscogsAPI();
  
  // Square API HTTP mocks (optional - can also use mock Square client)
  // Uncomment to use HTTP-level mocking for Square:
  // mockSquareAPI();
}

// Auto-setup mocks when this file is imported (if enabled)
if (USE_MOCKS) {
  setupAllMocks();
}
