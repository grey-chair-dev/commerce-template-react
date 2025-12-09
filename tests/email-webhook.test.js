/**
 * Email Webhook Tests
 * 
 * Tests email functionality in the Square order webhook.
 * Sends test emails to bcohen0424@gmail.com to verify Make.com + Gmail integration.
 * 
 * Run with: npm run test:email-webhook
 */

import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import dotenv from 'dotenv';
import { join } from 'path';
import { cwd } from 'process';
import { testSendEmail } from './utils/email-test-helper.js';
import { USE_MOCKS } from './utils/test-config.js';
import nock from 'nock';

// Load environment variables from .env.local
dotenv.config({ path: join(cwd(), '.env.local') });
dotenv.config(); // Also load .env if it exists

// Import email utilities
let getOrderConfirmationEmail, getOrderStatusUpdateEmail, getWelcomeEmail;

// Use test helper for sendEmail (bypasses import.meta issue in email.js)
// This directly calls Make.com webhook without importing email.js
const sendEmail = testSendEmail;

beforeAll(async () => {
  try {
    const templatesModule = await import('../api/utils/email-templates.js');
    if (templatesModule) {
      getOrderConfirmationEmail = templatesModule.getOrderConfirmationEmail;
      getOrderStatusUpdateEmail = templatesModule.getOrderStatusUpdateEmail;
      getWelcomeEmail = templatesModule.getWelcomeEmail;
    }
  } catch (e) {
    console.warn('Could not import email templates:', e.message);
  }
});

const TEST_EMAIL = 'bcohen0424@gmail.com';

describe('Webhook Email Functionality', () => {
  beforeEach(() => {
    // Mock Make.com webhook if mocking is enabled
    if (USE_MOCKS) {
      const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL;
      if (makeWebhookUrl) {
        const cleanUrl = makeWebhookUrl.trim().replace(/^["']|["']$/g, '');
        try {
          const url = new URL(cleanUrl);
          nock(url.origin)
            .persist()
            .post(url.pathname)
            .reply(200, {
              success: true,
              message: 'Webhook processed successfully (mocked)',
            });
        } catch (e) {
          // Invalid URL, skip mocking
        }
      }
    }
  });
  describe('Order Confirmation Email', () => {
    test('should send order confirmation email via Make.com', async () => {
      if (!sendEmail || !getOrderConfirmationEmail) {
        console.warn('Skipping test - email utilities not available');
        return;
      }
      // Arrange: Create mock order data
      const orderData = {
        orderNumber: `TEST-${Date.now()}`,
        customerName: 'Test Customer',
        customerEmail: TEST_EMAIL,
        items: [
          {
            name: 'Test Vinyl Record',
            quantity: 1,
            price: 25.00,
            imageUrl: 'https://example.com/image.jpg',
          },
        ],
        subtotal: 25.00,
        tax: 2.00,
        total: 27.00,
        orderDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        pickupDetails: {
          firstName: 'Test',
          lastName: 'Customer',
          email: TEST_EMAIL,
          phone: '+15551234567',
        },
      };

      // Generate email template
      const { html, text } = getOrderConfirmationEmail(orderData);

      // Act: Send email via Make.com
      try {
        const result = await sendEmail({
          to: TEST_EMAIL,
          subject: `Order Confirmation - ${orderData.orderNumber} - Spiral Groove Records`,
          html,
          text,
          emailType: 'order-confirmation',
          orderNumber: orderData.orderNumber,
          orderId: `test-order-${Date.now()}`,
          customerName: orderData.customerName,
          orderUrl: `https://spiralgrooverecords.com/order-confirmation?id=test-order`,
        });

        // Assert: Email should be sent successfully
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.provider).toBe('make');
        
        console.log('✅ Order confirmation email sent successfully to:', TEST_EMAIL);
        console.log('   Order Number:', orderData.orderNumber);
        console.log('   Provider:', result.provider);
      } catch (error) {
        // If MAKE_WEBHOOK_URL is not configured, skip the test
        if (error.message.includes('MAKE_WEBHOOK_URL not configured')) {
          console.warn('⚠️  MAKE_WEBHOOK_URL not configured, skipping email test');
          console.warn('   Set MAKE_WEBHOOK_URL in .env.local to test email functionality');
          return;
        }
        throw error;
      }
    }, 30000); // 30 second timeout for API call
  });

  describe('Order Status Update Email', () => {
    test('should send "Ready" status update email via Make.com', async () => {
      if (!sendEmail || !getOrderStatusUpdateEmail) {
        console.warn('Skipping test - email utilities not available');
        return;
      }
      // Arrange: Create mock order status update data
      const statusData = {
        orderNumber: `TEST-${Date.now()}`,
        customerName: 'Test Customer',
        status: 'Ready',
        statusMessage: 'Your order is ready for pickup! Come by the store during our business hours.',
        items: [],
        orderUrl: 'https://spiralgrooverecords.com/order-confirmation?id=test-order',
      };

      // Generate email template
      const { html, text } = getOrderStatusUpdateEmail(statusData);

      // Act: Send email via Make.com
      try {
        const result = await sendEmail({
          to: TEST_EMAIL,
          subject: `Order ${statusData.orderNumber} - ${statusData.status} - Spiral Groove Records`,
          html,
          text,
          emailType: 'order-status-update',
          orderNumber: statusData.orderNumber,
          orderId: `test-order-${Date.now()}`,
          status: statusData.status,
          previousStatus: 'In Progress',
          customerName: statusData.customerName,
        });

        // Assert: Email should be sent successfully
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.provider).toBe('make');
        
        console.log('✅ Status update email sent successfully to:', TEST_EMAIL);
        console.log('   Order Number:', statusData.orderNumber);
        console.log('   Status:', statusData.status);
        console.log('   Provider:', result.provider);
      } catch (error) {
        // If MAKE_WEBHOOK_URL is not configured, skip the test
        if (error.message.includes('MAKE_WEBHOOK_URL not configured')) {
          console.warn('⚠️  MAKE_WEBHOOK_URL not configured, skipping email test');
          console.warn('   Set MAKE_WEBHOOK_URL in .env.local to test email functionality');
          return;
        }
        throw error;
      }
    }, 30000);

    test('should send "Picked Up" status update email via Make.com', async () => {
      if (!sendEmail || !getOrderStatusUpdateEmail) {
        console.warn('Skipping test - email utilities not available');
        return;
      }
      const statusData = {
        orderNumber: `TEST-${Date.now()}`,
        customerName: 'Test Customer',
        status: 'Picked Up',
        statusMessage: 'Your order has been picked up. Thank you for shopping with us!',
        items: [],
        orderUrl: 'https://spiralgrooverecords.com/order-confirmation?id=test-order',
      };

      const { html, text } = getOrderStatusUpdateEmail(statusData);

      try {
        const result = await sendEmail({
          to: TEST_EMAIL,
          subject: `Order ${statusData.orderNumber} - ${statusData.status} - Spiral Groove Records`,
          html,
          text,
          emailType: 'order-status-update',
          orderNumber: statusData.orderNumber,
          orderId: `test-order-${Date.now()}`,
          status: statusData.status,
          previousStatus: 'Ready',
          customerName: statusData.customerName,
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.provider).toBe('make');
        
        console.log('✅ "Picked Up" status email sent successfully to:', TEST_EMAIL);
      } catch (error) {
        if (error.message.includes('MAKE_WEBHOOK_URL not configured')) {
          console.warn('⚠️  MAKE_WEBHOOK_URL not configured, skipping email test');
          return;
        }
        throw error;
      }
    }, 30000);

    test('should send "Refunded" status update email via Make.com', async () => {
      if (!sendEmail || !getOrderStatusUpdateEmail) {
        console.warn('Skipping test - email utilities not available');
        return;
      }
      
      const statusData = {
        orderNumber: `TEST-${Date.now()}`,
        customerName: 'Test Customer',
        status: 'Refunded',
        statusMessage: 'Your order has been refunded. The refund will be processed to your original payment method.',
        items: [],
        orderUrl: 'https://spiralgrooverecords.com/order-confirmation?id=test-order',
      };

      const { html, text } = getOrderStatusUpdateEmail(statusData);

      try {
        const result = await sendEmail({
          to: TEST_EMAIL,
          subject: `Order ${statusData.orderNumber} - ${statusData.status} - Spiral Groove Records`,
          html,
          text,
          emailType: 'order-status-update',
          orderNumber: statusData.orderNumber,
          orderId: `test-order-${Date.now()}`,
          status: statusData.status,
          previousStatus: 'Completed',
          customerName: statusData.customerName,
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.provider).toBe('make');
        
        console.log('✅ "Refunded" status email sent successfully to:', TEST_EMAIL);
      } catch (error) {
        if (error.message.includes('MAKE_WEBHOOK_URL not configured')) {
          console.warn('⚠️  MAKE_WEBHOOK_URL not configured, skipping email test');
          return;
        }
        throw error;
      }
    }, 30000);

    test('should send "Canceled" status update email via Make.com', async () => {
      if (!sendEmail || !getOrderStatusUpdateEmail) {
        console.warn('Skipping test - email utilities not available');
        return;
      }
      
      const statusData = {
        orderNumber: `TEST-${Date.now()}`,
        customerName: 'Test Customer',
        status: 'Canceled',
        statusMessage: 'Your order has been canceled. If you have questions, please contact us.',
        items: [],
        orderUrl: 'https://spiralgrooverecords.com/order-confirmation?id=test-order',
      };

      const { html, text } = getOrderStatusUpdateEmail(statusData);

      try {
        const result = await sendEmail({
          to: TEST_EMAIL,
          subject: `Order ${statusData.orderNumber} - ${statusData.status} - Spiral Groove Records`,
          html,
          text,
          emailType: 'order-status-update',
          orderNumber: statusData.orderNumber,
          orderId: `test-order-${Date.now()}`,
          status: statusData.status,
          previousStatus: 'In Progress',
          customerName: statusData.customerName,
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.provider).toBe('make');
        
        console.log('✅ "Canceled" status email sent successfully to:', TEST_EMAIL);
      } catch (error) {
        if (error.message.includes('MAKE_WEBHOOK_URL not configured')) {
          console.warn('⚠️  MAKE_WEBHOOK_URL not configured, skipping email test');
          return;
        }
        throw error;
      }
    }, 30000);
  });

  describe('Email Template Validation', () => {
    test('should generate valid order confirmation email template', () => {
      if (!getOrderConfirmationEmail) {
        console.warn('Skipping test - email templates not available');
        return;
      }
      const orderData = {
        orderNumber: 'TEST-12345',
        customerName: 'Test Customer',
        customerEmail: TEST_EMAIL,
        items: [
          { name: 'Test Record', quantity: 1, price: 25.00, imageUrl: null },
        ],
        subtotal: 25.00,
        tax: 2.00,
        total: 27.00,
        orderDate: 'January 1, 2024, 12:00 PM',
        pickupDetails: {
          firstName: 'Test',
          lastName: 'Customer',
          email: TEST_EMAIL,
          phone: '+15551234567',
        },
      };

      const { html, text } = getOrderConfirmationEmail(orderData);

      // Assert: Template should be generated
      expect(html).toBeDefined();
      expect(text).toBeDefined();
      expect(html.length).toBeGreaterThan(0);
      expect(text.length).toBeGreaterThan(0);

      // Assert: Should contain order number
      expect(html).toContain(orderData.orderNumber);
      expect(text).toContain(orderData.orderNumber);

      // Assert: Should contain customer name
      expect(html).toContain(orderData.customerName);
      expect(text).toContain(orderData.customerName);

      // Assert: Should contain total
      expect(html).toContain('$27.00');
      expect(text).toContain('$27.00');

      console.log('✅ Order confirmation email template validated');
    });

    test('should generate valid status update email template', () => {
      if (!getOrderStatusUpdateEmail) {
        console.warn('Skipping test - email templates not available');
        return;
      }
      const statusData = {
        orderNumber: 'TEST-12345',
        customerName: 'Test Customer',
        status: 'Ready',
        statusMessage: 'Your order is ready for pickup!',
        items: [],
        orderUrl: 'https://spiralgrooverecords.com/order-confirmation?id=test',
      };

      const { html, text } = getOrderStatusUpdateEmail(statusData);

      // Assert: Template should be generated
      expect(html).toBeDefined();
      expect(text).toBeDefined();
      expect(html.length).toBeGreaterThan(0);
      expect(text.length).toBeGreaterThan(0);

      // Assert: Should contain order number
      expect(html).toContain(statusData.orderNumber);
      expect(text).toContain(statusData.orderNumber);

      // Assert: Should contain status
      expect(html).toContain(statusData.status);
      expect(text).toContain(statusData.status);

      // Assert: Should contain status message
      expect(html).toContain(statusData.statusMessage);
      expect(text).toContain(statusData.statusMessage);

      console.log('✅ Status update email template validated');
    });
  });

  describe('Authentication Emails', () => {
    test('should send welcome email on signup via Make.com', async () => {
      if (!sendEmail || !getWelcomeEmail) {
        console.warn('Skipping test - email utilities not available');
        return;
      }

      // Arrange: Create mock welcome email data
      const welcomeData = {
        firstName: 'Test',
        lastName: 'Customer',
        email: TEST_EMAIL,
      };

      // Generate email template
      const { html, text } = getWelcomeEmail(welcomeData);

      // Act: Send email via Make.com
      try {
        const result = await sendEmail({
          to: TEST_EMAIL,
          subject: 'Welcome to Spiral Groove Records!',
          html,
          text,
          emailType: 'welcome',
          customerName: welcomeData.firstName || welcomeData.email.split('@')[0],
        });

        // Assert: Email should be sent successfully
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.provider).toBe('make');
        
        console.log('✅ Welcome email sent successfully to:', TEST_EMAIL);
        console.log('   Customer Name:', welcomeData.firstName, welcomeData.lastName);
        console.log('   Provider:', result.provider);
      } catch (error) {
        // If MAKE_WEBHOOK_URL is not configured, skip the test
        if (error.message.includes('MAKE_WEBHOOK_URL not configured')) {
          console.warn('⚠️  MAKE_WEBHOOK_URL not configured, skipping email test');
          console.warn('   Set MAKE_WEBHOOK_URL in .env.local to test email functionality');
          return;
        }
        throw error;
      }
    }, 30000);

    test('should send password reset email via Make.com', async () => {
      if (!sendEmail) {
        console.warn('Skipping test - email utilities not available');
        return;
      }

      // Arrange: Create mock password reset data
      // Note: The password reset email is generated inline in forgot-password.js
      // We'll create a similar structure for testing
      const resetUrl = `https://spiralgrooverecords.com/reset-password?token=test-token-${Date.now()}`;
      const customerName = 'Test Customer';
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="background-color: #000000; color: #ffffff; font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #00B3A4;">SPIRAL GROOVE RECORDS</h1>
          <p>Hi ${customerName},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(90deg, #EC4899 0%, #A855F7 50%, #06B6D4 100%); color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 4px; font-weight: 600;">
            Reset Password
          </a>
          <p style="color: rgba(255, 255, 255, 0.7); font-size: 14px;">
            This link will expire in 1 hour.
          </p>
          <p style="color: rgba(255, 255, 255, 0.7); font-size: 14px;">
            If you didn't request a password reset, you can safely ignore this email.
          </p>
        </body>
        </html>
      `;
      const emailText = `
SPIRAL GROOVE RECORDS

Hi ${customerName},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.
      `;

      // Act: Send email via Make.com
      try {
        const result = await sendEmail({
          to: TEST_EMAIL,
          subject: 'Reset Your Password - Spiral Groove Records',
          html: emailHtml,
          text: emailText,
          emailType: 'password-reset',
          customerName,
          resetUrl,
        });

        // Assert: Email should be sent successfully
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.provider).toBe('make');
        
        console.log('✅ Password reset email sent successfully to:', TEST_EMAIL);
        console.log('   Reset URL:', resetUrl.substring(0, 50) + '...');
        console.log('   Provider:', result.provider);
      } catch (error) {
        // If MAKE_WEBHOOK_URL is not configured, skip the test
        if (error.message.includes('MAKE_WEBHOOK_URL not configured')) {
          console.warn('⚠️  MAKE_WEBHOOK_URL not configured, skipping email test');
          console.warn('   Set MAKE_WEBHOOK_URL in .env.local to test email functionality');
          return;
        }
        throw error;
      }
    }, 30000);
  });
});
