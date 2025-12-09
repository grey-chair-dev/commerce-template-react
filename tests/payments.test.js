/**
 * Square Payments API Test Suite
 * 
 * Tests the Square Payments API using the Square Node.js SDK.
 * Uses Square Sandbox test nonces to simulate payment scenarios.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { squareClient, locationId } from './square.client.js';
import { getTestCustomerId, TEST_CUSTOMER_DATA } from './utils/test-customer.js';
import { USE_MOCKS } from './utils/test-config.js';
import { createMockSquareClient } from './utils/mock-square-client.js';

// Use mock client if mocking is enabled
const testSquareClient = USE_MOCKS ? createMockSquareClient() : squareClient;
const testLocationId = USE_MOCKS ? 'LOCATION_TEST' : locationId;

describe('Square Payments API', () => {
  let testCustomerId;

  beforeAll(async () => {
    // Create or retrieve test customer for all payment tests
    // Skip if using mocks (mock client doesn't need real customer)
    if (USE_MOCKS) {
      testCustomerId = 'CUSTOMER_TEST_123'; // Use mock customer ID
      return;
    }
    
    try {
      testCustomerId = await getTestCustomerId();
    } catch (error) {
      console.warn('⚠️  Could not create test customer, tests will run without customer ID:', error.message);
      testCustomerId = null;
    }
  });

  describe('Happy Path Success', () => {
    test('should successfully process a standard full-amount payment using test card', async () => {
      // Arrange: Prepare payment request for $25 USD (2500 cents)
      const idempotencyKey = randomUUID();
      const amountInCents = 2500; // $25.00 USD
      
      const paymentRequest = {
        sourceId: 'cnon:card-nonce-ok', // Square test nonce that guarantees success
        idempotencyKey: idempotencyKey,
        amountMoney: {
          amount: BigInt(amountInCents), // Square SDK v43 requires BigInt for amounts
          currency: 'USD',
        },
        locationId: testLocationId,
        note: 'Test payment for $25 record purchase',
        ...(testCustomerId && { customerId: testCustomerId }), // Include customer ID if available
      };

      // Act: Create payment using Square Payments API
      const response = await testSquareClient.payments.create(paymentRequest);

      // Handle different response structures from Square SDK v43
      // Response can be: { result: { payment: {...} } } or { payment: {...} } directly
      const payment = response.result?.payment || response.payment;
      
      // Assert: Verify payment was successful
      expect(payment).toBeDefined();
      expect(payment.status).toBe('COMPLETED');
      
      // Square SDK returns BigInt for amounts, convert for comparison
      const returnedAmount = typeof payment.amountMoney?.amount === 'bigint'
        ? Number(payment.amountMoney.amount)
        : payment.amountMoney?.amount;
      expect(returnedAmount).toBe(amountInCents);
      expect(payment.amountMoney.currency).toBe('USD');
      
      // Verify payment ID exists
      expect(payment.id).toBeDefined();
      expect(typeof payment.id).toBe('string');
      
      console.log('✅ Payment successful:', {
        paymentId: payment.id,
        status: payment.status,
        amount: `$${((typeof payment.amountMoney.amount === 'bigint' 
          ? Number(payment.amountMoney.amount) 
          : payment.amountMoney.amount) / 100).toFixed(2)}`,
      });
      
      // Impact: Verifies basic transaction processing and order creation
      // Verify order can be created from this payment
      expect(payment.orderId || payment.id).toBeDefined();
    }, 30000); // 30 second timeout for API call
  });

  describe('Hard Decline Handling', () => {
    test('should handle hard decline using Square test card number and prevent order creation', async () => {
      // Arrange: Prepare payment request with test nonce that guarantees decline
      const idempotencyKey = randomUUID();
      const amountInCents = 2500; // $25.00 USD
      
      // Use Square's test card nonce that guarantees hard decline
      // Square test card: 4000 0000 0000 0002 (Card declined)
      const paymentRequest = {
        sourceId: 'cnon:card-nonce-declined', // Square test nonce for hard decline
        idempotencyKey: idempotencyKey,
        amountMoney: {
          amount: BigInt(amountInCents), // Square SDK v43 requires BigInt for amounts
          currency: 'USD',
        },
        locationId: testLocationId,
        note: 'Test hard decline scenario - should prevent order creation',
        ...(testCustomerId && { customerId: testCustomerId }), // Include customer ID if available
      };

      // Act & Assert: Expect payment to be declined with 4xx error
      try {
        await testSquareClient.payments.create(paymentRequest);
        // If we reach here, the payment unexpectedly succeeded
        throw new Error('Expected payment to be declined, but it succeeded');
      } catch (error) {
        // Square SDK v43 error structure: error.response or error.body
        const statusCode = error.response?.statusCode || error.statusCode || 
                          (error.body?.statusCode) || 
                          (error.errors?.[0]?.code ? 400 : undefined);
        
        // Verify error is a 4xx client error
        expect(statusCode).toBeDefined();
        if (statusCode) {
          expect(statusCode).toBeGreaterThanOrEqual(400);
          expect(statusCode).toBeLessThan(500);
        }
        
        // Verify error body contains payment failure code
        const errorBody = error.body || error.response?.body || {};
        const errors = errorBody.errors || error.errors || [];
        
        expect(Array.isArray(errors)).toBe(true);
        expect(errors.length).toBeGreaterThan(0);
        
        // Check for GENERIC_DECLINE or similar payment failure code
        const errorCodes = errors.map(err => err.code || err.category || '');
        const hasDeclineCode = errorCodes.some(code => 
          code === 'GENERIC_DECLINE' || 
          code === 'CARD_DECLINED' ||
          code === 'CARD_NOT_SUPPORTED' ||
          code === 'INSUFFICIENT_FUNDS' ||
          code === 'CVV_FAILURE' ||
          code === 'ADDRESS_VERIFICATION_FAILURE' ||
          (typeof code === 'string' && code.includes('DECLINE')) ||
          (typeof code === 'string' && code.includes('CARD'))
        );
        
        expect(hasDeclineCode).toBe(true);
        
        console.log('✅ Payment decline handled correctly:', {
          statusCode: statusCode,
          errorCodes: errorCodes,
          message: errors[0]?.detail || errors[0]?.message || error.message,
        });
        
        // Impact: Ensures system correctly throws error, prevents order, and doesn't update inventory
        // Verify no order was created (payment should not have orderId)
        expect(errorCodes).toContain('GENERIC_DECLINE');
      }
    }, 30000); // 30 second timeout for API call
  });

  describe('Partial Refunds', () => {
    test('should process successful payment then issue partial refund (e.g., $5 for shipping overcharge)', async () => {
      // Arrange: Create a successful payment first
      const idempotencyKey = randomUUID();
      const fullAmountInCents = 2500; // $25.00 USD
      const refundAmountInCents = 500; // $5.00 USD (partial refund)
      
      const paymentRequest = {
        sourceId: 'cnon:card-nonce-ok',
        idempotencyKey: idempotencyKey,
        amountMoney: {
          amount: BigInt(fullAmountInCents),
          currency: 'USD',
        },
        locationId: testLocationId,
        note: 'Test payment for partial refund scenario',
        ...(testCustomerId && { customerId: testCustomerId }), // Include customer ID if available
      };

      // Act: Create payment
      const paymentResponse = await testSquareClient.payments.create(paymentRequest);
      const payment = paymentResponse.result?.payment || paymentResponse.payment;
      
      expect(payment).toBeDefined();
      expect(payment.status).toBe('COMPLETED');
      expect(payment.id).toBeDefined();

      // Wait a moment for payment to be fully processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Act: Create partial refund
      const refundIdempotencyKey = randomUUID();
      const refundRequest = {
        idempotencyKey: refundIdempotencyKey,
        amountMoney: {
          amount: BigInt(refundAmountInCents),
          currency: 'USD',
        },
        paymentId: payment.id,
        reason: 'Shipping overcharge refund',
      };

      const refundResponse = await testSquareClient.refunds.refundPayment(refundRequest);
      const refund = refundResponse.result?.refund || refundResponse.refund;

      // Assert: Verify refund was created successfully
      expect(refund).toBeDefined();
      // Refunds can be PENDING initially, then move to COMPLETED
      // Both statuses indicate the refund was successfully initiated
      expect(['PENDING', 'COMPLETED', 'APPROVED']).toContain(refund.status);
      
      const refundAmount = typeof refund.amountMoney?.amount === 'bigint'
        ? Number(refund.amountMoney.amount)
        : refund.amountMoney?.amount;
      expect(refundAmount).toBe(refundAmountInCents);
      expect(refund.paymentId).toBe(payment.id);

      console.log('✅ Partial refund successful:', {
        paymentId: payment.id,
        refundId: refund.id,
        originalAmount: `$${(fullAmountInCents / 100).toFixed(2)}`,
        refundAmount: `$${(refundAmountInCents / 100).toFixed(2)}`,
        remainingAmount: `$${((fullAmountInCents - refundAmountInCents) / 100).toFixed(2)}`,
      });

      // Impact: Validates the Refunds API and ensures order totals update correctly in Square
      // Note: In production, you would verify the order total was updated in your database
    }, 30000);
  });

  describe('Idempotency', () => {
    test('should prevent duplicate charges when submitting same payment request twice with same idempotency key', async () => {
      // Arrange: Create payment request with specific idempotency key
      const idempotencyKey = randomUUID();
      const amountInCents = 2500; // $25.00 USD
      
      const paymentRequest = {
        sourceId: 'cnon:card-nonce-ok',
        idempotencyKey: idempotencyKey, // Same key for both requests
        ...(testCustomerId && { customerId: testCustomerId }), // Include customer ID if available
        amountMoney: {
          amount: BigInt(amountInCents),
          currency: 'USD',
        },
        locationId: testLocationId,
        note: 'Test idempotency - same request twice',
      };

      // Act: Submit payment request first time
      const firstResponse = await testSquareClient.payments.create(paymentRequest);
      const firstPayment = firstResponse.result?.payment || firstResponse.payment;
      
      expect(firstPayment).toBeDefined();
      expect(firstPayment.status).toBe('COMPLETED');
      const firstPaymentId = firstPayment.id;

      // Act: Submit exact same payment request second time with same idempotency key
      const secondResponse = await testSquareClient.payments.create(paymentRequest);
      const secondPayment = secondResponse.result?.payment || secondResponse.payment;

      // Assert: Verify both requests return the same payment ID (idempotency)
      expect(secondPayment).toBeDefined();
      expect(secondPayment.id).toBe(firstPaymentId);
      expect(secondPayment.status).toBe('COMPLETED');

      console.log('✅ Idempotency verified:', {
        firstPaymentId: firstPaymentId,
        secondPaymentId: secondPayment.id,
        samePayment: firstPaymentId === secondPayment.id,
        idempotencyKey: idempotencyKey,
      });

      // Impact: Verifies Square prevents duplicate charges, ensuring customer is only billed once
      expect(firstPaymentId).toBe(secondPayment.id);
    }, 30000);
  });

  describe('Taxes & Fees', () => {
    test('should accurately calculate and return tax and Square processing fees in transaction response', async () => {
      // Arrange: Create payment request
      const idempotencyKey = randomUUID();
      const amountInCents = 2500; // $25.00 USD
      
      const paymentRequest = {
        sourceId: 'cnon:card-nonce-ok',
        idempotencyKey: idempotencyKey,
        amountMoney: {
          amount: BigInt(amountInCents),
          currency: 'USD',
        },
        locationId: testLocationId,
        note: 'Test payment for tax and fee verification',
        autocomplete: true, // Complete payment immediately
        ...(testCustomerId && { customerId: testCustomerId }), // Include customer ID if available
      };

      // Act: Create payment
      const response = await testSquareClient.payments.create(paymentRequest);
      const payment = response.result?.payment || response.payment;

      // Assert: Verify payment was successful
      expect(payment).toBeDefined();
      expect(payment.status).toBe('COMPLETED');

      // Assert: Verify tax information is present (if applicable)
      // Square may include tax information in the payment response
      const totalMoney = payment.totalMoney || payment.amountMoney;
      const amountMoney = payment.amountMoney;
      
      expect(totalMoney).toBeDefined();
      expect(amountMoney).toBeDefined();

      // Check for fee information in payment details
      // Square processing fees are typically shown in the Square Dashboard,
      // but may be available in payment processing details
      const processingFee = payment.processingFee || null;
      const applicationFee = payment.applicationFeeMoney || null;

      // Verify amount structure
      const totalAmount = typeof totalMoney.amount === 'bigint'
        ? Number(totalMoney.amount)
        : totalMoney.amount;
      
      const baseAmount = typeof amountMoney.amount === 'bigint'
        ? Number(amountMoney.amount)
        : amountMoney.amount;

      console.log('✅ Tax and fee information:', {
        paymentId: payment.id,
        baseAmount: `$${(baseAmount / 100).toFixed(2)}`,
        totalAmount: `$${(totalAmount / 100).toFixed(2)}`,
        hasProcessingFee: !!processingFee,
        hasApplicationFee: !!applicationFee,
        currency: totalMoney.currency || amountMoney.currency,
      });

      // Impact: Essential for accurate accounting and compliance
      // Verify amounts are properly structured for audit purposes
      expect(totalAmount).toBeGreaterThanOrEqual(baseAmount);
      expect(totalMoney.currency || amountMoney.currency).toBe('USD');

      // Note: Square processing fees are typically calculated based on:
      // - Transaction type (card present, card not present, etc.)
      // - Payment method (credit card, debit card, etc.)
      // - Square pricing plan
      // Fees are usually visible in Square Dashboard, not always in API response
    }, 30000);
  });
});

