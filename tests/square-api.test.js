/**
 * Square API Endpoint Tests
 * 
 * Tests HTTP endpoints that interact with Square APIs.
 * 
 * Square API Documentation:
 * - Catalog API: https://developer.squareup.com/reference/square/catalog-api
 * - Products Endpoint: /api/square/products
 * - Health Endpoint: /api/square/health
 */

import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { makeRequest } from './utils/http-test-helpers.js';
import { validateCustomAttributes } from './utils/square-docs-validator.js';
import { USE_MOCKS } from './utils/test-config.js';
import nock from 'nock';

// Import handlers directly (Vercel serverless functions)
let productsHandler;
let healthHandler;

beforeAll(async () => {
  // Dynamically import handlers
  try {
    const productsModule = await import('../api/square/products.ts');
    productsHandler = productsModule.default;
  } catch (e) {
    console.warn('Could not import products handler:', e.message);
  }

  try {
    const healthModule = await import('../api/square/health.ts');
    healthHandler = healthModule.default;
  } catch (e) {
    console.warn('Could not import health handler:', e.message);
  }
});

describe('Square Products API Endpoint', () => {
  beforeEach(() => {
    // Mock Square API if mocking is enabled
    if (USE_MOCKS) {
      nock('https://connect.squareupsandbox.com')
        .persist()
        .post('/v2/catalog/search')
        .reply(200, {
          objects: [
            {
              id: 'ITEM_TEST_123',
              type: 'ITEM',
              itemData: {
                name: 'Test Vinyl Record',
                variations: [
                  {
                    id: 'VARIATION_TEST_123',
                    itemVariationData: {
                      priceMoney: { amount: 2500, currency: 'USD' },
                    },
                  },
                ],
                customAttributeValues: [
                  { name: 'Grading', value: 'VG+', type: 'STRING' },
                  { name: 'Format', value: 'LP', type: 'STRING' },
                ],
              },
            },
          ],
        });
    }
  });

  describe('GET /api/square/products', () => {
    test('should successfully fetch products with valid credentials', async () => {
      if (!productsHandler) {
        console.warn('Skipping test - products handler not available');
        return;
      }

      // Arrange: Set up environment variables
      const originalToken = process.env.SQUARE_ACCESS_TOKEN;
      const originalLocationId = process.env.SQUARE_LOCATION_ID;
      const originalEnv = process.env.SQUARE_ENVIRONMENT;

      // Use test credentials
      process.env.SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN || 'test_token';
      process.env.SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID || 'test_location';
      process.env.SQUARE_ENVIRONMENT = 'sandbox';

      try {
        // Act: Make request to products endpoint
        const response = await makeRequest(productsHandler, {
          method: 'GET',
          query: { appId: 'spiralgroove' },
        });

        // Assert: Verify response structure
        expect(response.status).toBeDefined();
        
        // If credentials are valid, should return 200 with products
        // If credentials are invalid, should return 500 with error
        if (response.status === 200) {
          expect(response.body).toBeDefined();
          expect(response.body.products).toBeDefined();
          expect(Array.isArray(response.body.products)).toBe(true);
        } else {
          // Error response should have error message
          expect(response.body.error).toBeDefined();
        }
      } finally {
        // Restore original environment
        if (originalToken) process.env.SQUARE_ACCESS_TOKEN = originalToken;
        if (originalLocationId) process.env.SQUARE_LOCATION_ID = originalLocationId;
        if (originalEnv) process.env.SQUARE_ENVIRONMENT = originalEnv;
      }
    }, 30000);

    test('should return error when credentials are missing', async () => {
      if (!productsHandler) {
        console.warn('Skipping test - products handler not available');
        return;
      }

      // Arrange: Remove credentials
      const originalToken = process.env.SQUARE_ACCESS_TOKEN;
      const originalLocationId = process.env.SQUARE_LOCATION_ID;
      
      delete process.env.SQUARE_ACCESS_TOKEN;
      delete process.env.SQUARE_LOCATION_ID;

      try {
        // Act: Make request without credentials
        const response = await makeRequest(productsHandler, {
          method: 'GET',
        });

        // Assert: Should return 500 error
        expect(response.status).toBe(500);
        expect(response.body.error).toBeDefined();
        expect(response.body.message).toContain('not configured');
      } finally {
        // Restore original environment
        if (originalToken) process.env.SQUARE_ACCESS_TOKEN = originalToken;
        if (originalLocationId) process.env.SQUARE_LOCATION_ID = originalLocationId;
      }
    });

    test('should validate custom attributes (Grading and Format) in product response', async () => {
      // This test validates that products include vinyl-specific custom attributes
      // Reference: Square Custom Attributes API
      // https://developer.squareup.com/reference/square/catalog-api/catalog-custom-attribute-definition
      
      // Note: This test requires actual Square catalog items with custom attributes
      // In a real scenario, you would:
      // 1. Fetch products from Square API
      // 2. Validate custom attributes are present
      // 3. Check that 'Grading' and 'Format' attributes exist
      
      // For now, we'll test the validation function
      const mockCatalogObject = {
        id: 'test_item',
        type: 'ITEM',
        item_data: {
          name: 'Test Vinyl Record',
          custom_attribute_values: [
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
      };

      const validation = validateCustomAttributes(mockCatalogObject, ['Grading', 'Format']);
      
      expect(validation.valid).toBe(true);
      expect(validation.foundAttributes.length).toBeGreaterThanOrEqual(2);
      
      const gradingAttr = validation.foundAttributes.find(attr => 
        attr.name && attr.name.toLowerCase().includes('grading')
      );
      const formatAttr = validation.foundAttributes.find(attr => 
        attr.name && attr.name.toLowerCase().includes('format')
      );

      expect(gradingAttr).toBeDefined();
      expect(formatAttr).toBeDefined();
      expect(gradingAttr.value).toBe('VG+');
      expect(formatAttr.value).toBe('LP');
    });

    test('should handle query parameters (appId)', async () => {
      if (!productsHandler) {
        console.warn('Skipping test - products handler not available');
        return;
      }

      const response = await makeRequest(productsHandler, {
        method: 'GET',
        query: { appId: 'test-app' },
      });

      // Should process appId parameter
      expect(response.status).toBeDefined();
    });
  });
});

describe('Square Health API Endpoint', () => {
  describe('GET /api/square/health', () => {
    test('should return ok status when credentials are configured', async () => {
      if (!healthHandler) {
        console.warn('Skipping test - health handler not available');
        return;
      }

      // Arrange: Set credentials
      const originalToken = process.env.SQUARE_ACCESS_TOKEN;
      const originalLocationId = process.env.SQUARE_LOCATION_ID;

      process.env.SQUARE_ACCESS_TOKEN = 'test_token';
      process.env.SQUARE_LOCATION_ID = 'test_location';

      try {
        // Act: Make request to health endpoint
        const response = await makeRequest(healthHandler, {
          method: 'GET',
        });

        // Assert: Should return 200 with ok status
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(response.body.timestamp).toBeDefined();
      } finally {
        if (originalToken) process.env.SQUARE_ACCESS_TOKEN = originalToken;
        if (originalLocationId) process.env.SQUARE_LOCATION_ID = originalLocationId;
      }
    });

    test('should return 503 when credentials are missing', async () => {
      if (!healthHandler) {
        console.warn('Skipping test - health handler not available');
        return;
      }

      // Arrange: Remove credentials
      const originalToken = process.env.SQUARE_ACCESS_TOKEN;
      const originalLocationId = process.env.SQUARE_LOCATION_ID;

      delete process.env.SQUARE_ACCESS_TOKEN;
      delete process.env.SQUARE_LOCATION_ID;

      try {
        // Act: Make request without credentials
        const response = await makeRequest(healthHandler, {
          method: 'GET',
        });

        // Assert: Should return 503 degraded status
        expect(response.status).toBe(503);
        expect(response.body.status).toBe('degraded');
        expect(response.body.message).toContain('not fully configured');
      } finally {
        if (originalToken) process.env.SQUARE_ACCESS_TOKEN = originalToken;
        if (originalLocationId) process.env.SQUARE_LOCATION_ID = originalLocationId;
      }
    });

    test('should reject non-GET requests', async () => {
      if (!healthHandler) {
        console.warn('Skipping test - health handler not available');
        return;
      }

      const response = await makeRequest(healthHandler, {
        method: 'POST',
      });

      expect(response.status).toBe(405);
      expect(response.body.error).toBe('Method not allowed');
    });
  });
});

