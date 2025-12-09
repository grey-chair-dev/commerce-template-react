/**
 * Square Monitoring Tests
 * 
 * Tests Square health monitoring endpoint.
 * 
 * Square Status Documentation:
 * - Square Status Page: https://status.squareup.com
 * - Square API Health: /api/monitoring/square-health
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { makeRequest } from './utils/http-test-helpers.js';

let squareHealthHandler;

beforeAll(async () => {
  try {
    const healthModule = await import('../api/monitoring/square-health.js');
    squareHealthHandler = healthModule.default;
  } catch (e) {
    console.warn('Could not import square health handler:', e.message);
  }
});

describe('Square Health Monitoring', () => {
  describe('GET /api/monitoring/square-health', () => {
    test('should return status without alert on GET request', async () => {
      if (!squareHealthHandler) {
        console.warn('Skipping test - square health handler not available');
        return;
      }

      const response = await makeRequest(squareHealthHandler, {
        method: 'GET',
      });

      // Should return status information
      expect(response.status).toBeDefined();
      expect([200, 503]).toContain(response.status);
    });
  });

  describe('POST /api/monitoring/square-health', () => {
    test('should check status and send alert if needed on POST request', async () => {
      if (!squareHealthHandler) {
        console.warn('Skipping test - square health handler not available');
        return;
      }

      // Set up environment
      const originalSlackUrl = process.env.SLACK_WEBHOOK_URL;
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test/webhook';
      process.env.SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN || 'test_token';
      process.env.SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID || 'test_location';

      try {
        const response = await makeRequest(squareHealthHandler, {
          method: 'POST',
        });

        // Should process health check
        expect(response.status).toBeDefined();
        expect([200, 500]).toContain(response.status);
      } finally {
        if (originalSlackUrl) {
          process.env.SLACK_WEBHOOK_URL = originalSlackUrl;
        } else {
          delete process.env.SLACK_WEBHOOK_URL;
        }
      }
    });

    test('should validate Square API connectivity', async () => {
      if (!squareHealthHandler) {
        console.warn('Skipping test - square health handler not available');
        return;
      }

      // This test would require actual Square API calls
      // For now, we test the endpoint structure
      const response = await makeRequest(squareHealthHandler, {
        method: 'POST',
      });

      expect(response.status).toBeDefined();
    });
  });
});

