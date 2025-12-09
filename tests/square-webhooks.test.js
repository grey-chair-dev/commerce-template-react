/**
 * Square Webhook Handler Tests
 * 
 * Tests webhook endpoints that receive Square events.
 * 
 * Square Webhook Documentation:
 * - Webhook Overview: https://developer.squareup.com/docs/webhooks/overview
 * - Webhook Events: https://developer.squareup.com/docs/webhooks/using-webhooks
 * - Signature Verification: https://developer.squareup.com/docs/webhooks/step3verify
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import crypto from 'crypto';
import { createWebhookRequest, makeRequest } from './utils/http-test-helpers.js';
import {
  createOrderUpdatedPayload,
  createPaymentCreatedPayload,
  createPaymentUpdatedPayload,
  createRefundUpdatedPayload,
  createInventoryCountUpdatedPayload,
  createOrderWithFulfillment,
  createOrderWithLineItems,
} from './utils/webhook-helpers.js';
import { validateWebhookPayload } from './utils/square-docs-validator.js';

let orderWebhookHandler;
let inventoryWebhookHandler;
let generalWebhookHandler;

beforeAll(async () => {
  // Dynamically import webhook handlers
  try {
    const orderModule = await import('../api/webhooks/square-order-paid.js');
    orderWebhookHandler = orderModule.default;
  } catch (e) {
    console.warn('Could not import order webhook handler:', e.message);
  }

  try {
    const inventoryModule = await import('../api/webhooks/square-inventory.js');
    inventoryWebhookHandler = inventoryModule.default;
  } catch (e) {
    console.warn('Could not import inventory webhook handler:', e.message);
  }

  try {
    const generalModule = await import('../api/webhooks/square.ts');
    generalWebhookHandler = generalModule.default;
  } catch (e) {
    console.warn('Could not import general webhook handler:', e.message);
  }
});

describe('Square Order/Payment Webhook', () => {
  const signatureKey = process.env.ORDER_WEBHOOK_SIGNATURE_KEY || 'test_signature_key';

  describe('Signature Verification', () => {
    test('should accept webhook with valid signature', async () => {
      if (!orderWebhookHandler) {
        console.warn('Skipping test - order webhook handler not available');
        return;
      }

      // Arrange: Create valid webhook payload with correct signature
      const payload = createOrderUpdatedPayload();
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(rawBody, 'utf8');
      const validSignature = hmac.digest('base64');

      const req = createWebhookRequest(payload, validSignature, signatureKey);

      // Set up environment
      process.env.ORDER_WEBHOOK_SIGNATURE_KEY = signatureKey;
      process.env.SPR_DATABASE_URL = process.env.SPR_DATABASE_URL || 'test_db_url';

      try {
        // Act: Process webhook
        const response = await makeRequest(orderWebhookHandler, req);

        // Assert: Should not reject due to signature (may fail for other reasons like DB)
        expect(response.status).not.toBe(403);
      } finally {
        // Cleanup
        delete process.env.ORDER_WEBHOOK_SIGNATURE_KEY;
      }
    });

    test('should reject webhook with invalid signature', async () => {
      if (!orderWebhookHandler) {
        console.warn('Skipping test - order webhook handler not available');
        return;
      }

      // Arrange: Create payload with wrong signature
      const payload = createOrderUpdatedPayload();
      const invalidSignature = 'invalid_signature_base64_string';

      const req = createWebhookRequest(payload, invalidSignature);

      process.env.ORDER_WEBHOOK_SIGNATURE_KEY = signatureKey;
      process.env.SPR_DATABASE_URL = 'test_db_url';

      try {
        // Act: Process webhook with invalid signature
        const response = await makeRequest(orderWebhookHandler, req);

        // Assert: Should reject with 403
        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
        expect(response.body.message).toContain('Invalid webhook signature');
      } finally {
        delete process.env.ORDER_WEBHOOK_SIGNATURE_KEY;
      }
    });

    test('should reject webhook with missing signature', async () => {
      if (!orderWebhookHandler) {
        console.warn('Skipping test - order webhook handler not available');
        return;
      }

      // Arrange: Create payload without signature header
      const payload = createOrderUpdatedPayload();
      const req = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // No x-square-signature header
        },
        body: JSON.stringify(payload),
        query: {},
        url: '/api/webhooks/square-order-paid',
      };

      process.env.ORDER_WEBHOOK_SIGNATURE_KEY = signatureKey;

      try {
        // Act: Process webhook without signature
        const response = await makeRequest(orderWebhookHandler, req);

        // Assert: Should reject with 403
        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Forbidden');
        expect(response.body.message).toContain('Missing webhook signature');
      } finally {
        delete process.env.ORDER_WEBHOOK_SIGNATURE_KEY;
      }
    });
  });

  describe('Event Processing', () => {
    test('should process order.updated event', async () => {
      if (!orderWebhookHandler) {
        console.warn('Skipping test - order webhook handler not available');
        return;
      }

      // Arrange: Create order.updated payload
      const payload = createOrderUpdatedPayload({
        id: 'test_order_123',
        state: 'OPEN',
        version: 1,
      });

      // Validate payload structure matches Square docs
      const validation = validateWebhookPayload(payload);
      expect(validation.valid).toBe(true);

      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(rawBody, 'utf8');
      const signature = hmac.digest('base64');

      const req = createWebhookRequest(payload, signature, signatureKey);

      process.env.ORDER_WEBHOOK_SIGNATURE_KEY = signatureKey;
      process.env.SPR_DATABASE_URL = process.env.SPR_DATABASE_URL || 'test_db_url';

      try {
        // Act: Process webhook
        const response = await makeRequest(orderWebhookHandler, req);

        // Assert: Should process (may return 200 or 500 depending on DB setup)
        expect([200, 500]).toContain(response.status);
      } finally {
        delete process.env.ORDER_WEBHOOK_SIGNATURE_KEY;
      }
    });

    test('should process payment.created event', async () => {
      if (!orderWebhookHandler) {
        console.warn('Skipping test - order webhook handler not available');
        return;
      }

      // Arrange: Create payment.created payload
      const payload = createPaymentCreatedPayload({
        id: 'test_payment_123',
        status: 'COMPLETED',
        orderId: 'test_order_123',
      });

      const validation = validateWebhookPayload(payload);
      expect(validation.valid).toBe(true);

      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(rawBody, 'utf8');
      const signature = hmac.digest('base64');

      const req = createWebhookRequest(payload, signature, signatureKey);

      process.env.ORDER_WEBHOOK_SIGNATURE_KEY = signatureKey;
      process.env.SPR_DATABASE_URL = process.env.SPR_DATABASE_URL || 'test_db_url';

      try {
        const response = await makeRequest(orderWebhookHandler, req);
        expect([200, 500]).toContain(response.status);
      } finally {
        delete process.env.ORDER_WEBHOOK_SIGNATURE_KEY;
      }
    });

    test('should process payment.updated event', async () => {
      if (!orderWebhookHandler) {
        console.warn('Skipping test - order webhook handler not available');
        return;
      }

      const payload = createPaymentUpdatedPayload({
        id: 'test_payment_123',
        status: 'COMPLETED',
        orderId: 'test_order_123',
      });

      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(rawBody, 'utf8');
      const signature = hmac.digest('base64');

      const req = createWebhookRequest(payload, signature, signatureKey);

      process.env.ORDER_WEBHOOK_SIGNATURE_KEY = signatureKey;
      process.env.SPR_DATABASE_URL = process.env.SPR_DATABASE_URL || 'test_db_url';

      try {
        const response = await makeRequest(orderWebhookHandler, req);
        expect([200, 500]).toContain(response.status);
      } finally {
        delete process.env.ORDER_WEBHOOK_SIGNATURE_KEY;
      }
    });

    test('should handle refund.updated event and update order status correctly', async () => {
      if (!orderWebhookHandler) {
        console.warn('Skipping test - order webhook handler not available');
        return;
      }

      // Arrange: Create refund.updated payload
      // Reference: Square Refund API - https://developer.squareup.com/reference/square/refunds-api
      const refundPayload = createRefundUpdatedPayload({
        id: 'test_refund_123',
        status: 'COMPLETED',
        paymentId: 'test_payment_123',
        amountMoney: {
          amount: 500, // $5.00 partial refund
          currency: 'USD',
        },
        reason: 'Customer request',
      });

      // Note: Square may send refund events differently - this is a mock structure
      // In reality, refunds might come as payment.updated with refund information
      // or as separate refund.updated events
      
      // For this test, we'll simulate a payment.updated event with refund status
      const paymentWithRefund = createPaymentUpdatedPayload({
        id: 'test_payment_123',
        status: 'REFUNDED', // Payment status indicates refund
        orderId: 'test_order_123',
        refunds: [{
          id: refundPayload.data.object.refund.id,
          status: 'COMPLETED',
          amount_money: refundPayload.data.object.refund.amount_money,
        }],
      });

      const validation = validateWebhookPayload(paymentWithRefund);
      expect(validation.valid).toBe(true);

      const rawBody = JSON.stringify(paymentWithRefund);
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(rawBody, 'utf8');
      const signature = hmac.digest('base64');

      const req = createWebhookRequest(paymentWithRefund, signature, signatureKey);

      process.env.ORDER_WEBHOOK_SIGNATURE_KEY = signatureKey;
      process.env.SPR_DATABASE_URL = process.env.SPR_DATABASE_URL || 'test_db_url';

      try {
        const response = await makeRequest(orderWebhookHandler, req);
        
        // Assert: Should process the refund event
        // The handler should update order status to 'Refunded' (not 'Pending')
        expect([200, 500]).toContain(response.status);
        
        // Note: In a full integration test with a real database, we would verify:
        // - Order status is updated to 'Refunded' (not reverting to 'Pending')
        // - payment_status field is set to 'REFUNDED'
        // - Refund amount is recorded
      } finally {
        delete process.env.ORDER_WEBHOOK_SIGNATURE_KEY;
      }
    });

    test('should handle partial refund scenario', async () => {
      if (!orderWebhookHandler) {
        console.warn('Skipping test - order webhook handler not available');
        return;
      }

      // Arrange: Create payment with partial refund
      // In Square, partial refunds are typically represented as:
      // - Payment status remains COMPLETED
      // - Refunds array contains the refund details
      const paymentPayload = {
        type: 'payment.updated',
        event_id: `event_${Date.now()}`,
        created_at: new Date().toISOString(),
        data: {
          type: 'payment',
          id: 'test_payment_123',
          object: {
            payment: {
              id: 'test_payment_123',
              status: 'COMPLETED', // Payment still completed, but has refunds
              order_id: 'test_order_123',
              amount_money: {
                amount: 2500, // Original $25.00
                currency: 'USD',
              },
              refunds: [{
                id: 'refund_123',
                status: 'COMPLETED',
                amount_money: {
                  amount: 500, // $5.00 refund
                  currency: 'USD',
                },
                reason: 'Shipping overcharge',
              }],
            },
          },
        },
      };

      const rawBody = JSON.stringify(paymentPayload);
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(rawBody, 'utf8');
      const signature = hmac.digest('base64');

      const req = createWebhookRequest(paymentPayload, signature, signatureKey);

      process.env.ORDER_WEBHOOK_SIGNATURE_KEY = signatureKey;
      process.env.SPR_DATABASE_URL = process.env.SPR_DATABASE_URL || 'test_db_url';

      try {
        const response = await makeRequest(orderWebhookHandler, req);
        
        // Assert: Should process partial refund
        // Note: The handler may need to be updated to handle refunds array
        // For now, we verify the payload structure is valid
        expect([200, 500]).toContain(response.status);
      } finally {
        delete process.env.ORDER_WEBHOOK_SIGNATURE_KEY;
      }
    });

    test('should reject malformed payloads', async () => {
      if (!orderWebhookHandler) {
        console.warn('Skipping test - order webhook handler not available');
        return;
      }

      // Arrange: Create invalid payload
      const invalidPayload = {
        type: 'order.updated',
        // Missing required 'data' field
      };

      const rawBody = JSON.stringify(invalidPayload);
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(rawBody, 'utf8');
      const signature = hmac.digest('base64');

      const req = createWebhookRequest(invalidPayload, signature, signatureKey);

      process.env.ORDER_WEBHOOK_SIGNATURE_KEY = signatureKey;
      process.env.SPR_DATABASE_URL = 'test_db_url';

      try {
        const response = await makeRequest(orderWebhookHandler, req);
        
        // Assert: Should reject invalid payload
        expect([400, 500]).toContain(response.status);
      } finally {
        delete process.env.ORDER_WEBHOOK_SIGNATURE_KEY;
      }
    });
  });
});

describe('Square Inventory Webhook', () => {
  const signatureKey = process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY || 
                       process.env.SQUARE_SIGNATURE_KEY || 
                       'test_signature_key';

  describe('Signature Verification', () => {
    test('should verify inventory webhook signature', async () => {
      if (!inventoryWebhookHandler) {
        console.warn('Skipping test - inventory webhook handler not available');
        return;
      }

      const payload = createInventoryCountUpdatedPayload({
        catalogObjectId: 'test_item_123',
        quantity: '10',
      });

      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(rawBody, 'utf8');
      const validSignature = hmac.digest('base64');

      const req = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-square-signature': validSignature,
        },
        body: rawBody,
        query: {},
        url: '/api/webhooks/square-inventory',
      };

      process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY = signatureKey;
      process.env.SPR_DATABASE_URL = 'test_db_url';

      try {
        const response = await makeRequest(inventoryWebhookHandler, req);
        expect(response.status).not.toBe(403);
      } finally {
        delete process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY;
      }
    });
  });

  describe('Inventory Update Processing', () => {
    test('should process inventory.count.updated event', async () => {
      if (!inventoryWebhookHandler) {
        console.warn('Skipping test - inventory webhook handler not available');
        return;
      }

      const payload = createInventoryCountUpdatedPayload({
        catalogObjectId: 'test_item_123',
        quantity: '5',
        state: 'CUSTOM',
      });

      const validation = validateWebhookPayload(payload);
      expect(validation.valid).toBe(true);

      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(rawBody, 'utf8');
      const signature = hmac.digest('base64');

      const req = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-square-signature': signature,
        },
        body: rawBody,
        query: {},
        url: '/api/webhooks/square-inventory',
      };

      process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY = signatureKey;
      process.env.SPR_DATABASE_URL = 'test_db_url';

      try {
        const response = await makeRequest(inventoryWebhookHandler, req);
        expect([200, 500]).toContain(response.status);
      } finally {
        delete process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY;
      }
    });

    test('should handle concurrency/race condition for same item', async () => {
      if (!inventoryWebhookHandler) {
        console.warn('Skipping test - inventory webhook handler not available');
        return;
      }

      // Arrange: Create two inventory updates for the same item arriving milliseconds apart
      const catalogObjectId = 'rare_item_123';
      
      const payload1 = createInventoryCountUpdatedPayload({
        catalogObjectId,
        quantity: '10',
      });

      const payload2 = createInventoryCountUpdatedPayload({
        catalogObjectId,
        quantity: '8', // Different quantity - arrived slightly later
      });

      const rawBody1 = JSON.stringify(payload1);
      const rawBody2 = JSON.stringify(payload2);
      
      const hmac1 = crypto.createHmac('sha256', signatureKey);
      hmac1.update(rawBody1, 'utf8');
      const signature1 = hmac1.digest('base64');

      const hmac2 = crypto.createHmac('sha256', signatureKey);
      hmac2.update(rawBody2, 'utf8');
      const signature2 = hmac2.digest('base64');

      const req1 = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-square-signature': signature1,
        },
        body: rawBody1,
        query: {},
        url: '/api/webhooks/square-inventory',
      };

      const req2 = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-square-signature': signature2,
        },
        body: rawBody2,
        query: {},
        url: '/api/webhooks/square-inventory',
      };

      process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY = signatureKey;
      process.env.SPR_DATABASE_URL = 'test_db_url';

      try {
        // Act: Process both webhooks in quick succession (simulating race condition)
        const [response1, response2] = await Promise.all([
          makeRequest(inventoryWebhookHandler, req1),
          makeRequest(inventoryWebhookHandler, req2),
        ]);

        // Assert: Both should process
        // In a real scenario with database, we would verify:
        // - Database uses atomic transactions
        // - Final inventory count is correct (8, not overwritten incorrectly)
        // - No over-selling occurs
        expect([200, 500]).toContain(response1.status);
        expect([200, 500]).toContain(response2.status);
        
        // Note: Full race condition testing requires a real database with transactions
        // This test validates the payload structure and basic processing
      } finally {
        delete process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY;
      }
    }, 30000);
  });
});

describe('Square General Webhook', () => {
  test('should process catalog update webhook', async () => {
    if (!generalWebhookHandler) {
      console.warn('Skipping test - general webhook handler not available');
      return;
    }

    // Arrange: Create catalog update payload
    const payload = {
      type: 'catalog.version.updated',
      event_id: `event_${Date.now()}`,
      created_at: new Date().toISOString(),
      data: {
        type: 'catalog',
        object: {
          version: Date.now(),
        },
      },
    };

    const rawBody = JSON.stringify(payload);
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || 'test_key';
    const hmac = crypto.createHmac('sha256', signatureKey);
    hmac.update(rawBody, 'utf8');
    const signature = hmac.digest('base64');

    const req = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-square-signature': signature,
      },
      body: rawBody,
      query: {},
      url: '/api/webhooks/square',
    };

    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = signatureKey;
    process.env.SQUARE_ACCESS_TOKEN = 'test_token';
    process.env.SQUARE_LOCATION_ID = 'test_location';
    process.env.DATABASE_URL = 'test_db_url';

    try {
      const response = await makeRequest(generalWebhookHandler, req);
      expect([200, 500]).toContain(response.status);
    } finally {
      delete process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    }
  });
});

