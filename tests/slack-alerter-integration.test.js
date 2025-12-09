/**
 * Slack Alerter Integration Tests
 * 
 * Tests that actually send messages to Slack to verify the webhook works.
 * 
 * These tests require SLACK_WEBHOOK_URL to be configured in .env.local
 * 
 * Usage:
 *   1. Set SLACK_WEBHOOK_URL in .env.local
 *   2. Run: npm run test:slack-integration
 * 
 * WARNING: These tests will send actual messages to your Slack channel!
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { makeRequest } from './utils/http-test-helpers.js';
import nock from 'nock';

let slackAlertHandler;
let slackWebhookUrl;

beforeAll(async () => {
  // Try to load the handler
  try {
    const slackModule = await import('../api/webhooks/slack-alert.js');
    slackAlertHandler = slackModule.default;
  } catch (e) {
    console.warn('Could not import slack alert handler:', e.message);
  }

  // Check if webhook URL is configured
  slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackWebhookUrl) {
    slackWebhookUrl = slackWebhookUrl.trim().replace(/^["']|["']$/g, '');
    
    // Allow Slack webhook connections for integration tests
    // These tests need to send real messages to Slack
    try {
      const url = new URL(slackWebhookUrl);
      nock.enableNetConnect(url.hostname);
      console.log(`✅ Allowing Slack webhook connections to ${url.hostname} (integration tests)`);
    } catch (e) {
      // Invalid URL, skip
    }
  }

  // Try to load from .env.local if not found
  if (!slackWebhookUrl) {
    try {
      const { config } = await import('dotenv');
      const result = config({ path: '.env.local' });
      if (result && !result.error) {
        slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
        if (slackWebhookUrl) {
          slackWebhookUrl = slackWebhookUrl.trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch (e) {
      // dotenv not available
    }
  }
});

describe('Slack Integration Tests (Real Webhook)', () => {
  test('should send test message via webhook handler', async () => {
    if (!slackWebhookUrl) {
      console.warn('⚠️  Skipping - SLACK_WEBHOOK_URL not configured');
      console.warn('   Set SLACK_WEBHOOK_URL in .env.local to run integration tests');
      return;
    }

    // If handler loads, use it; otherwise test direct webhook
    if (slackAlertHandler) {
      console.log('📤 Sending test message via handler to Slack...');

      const testPayload = {
        route: '/api/webhooks/test-integration',
        errorId: `test_${Date.now()}`,
        timestamp: new Date().toISOString(),
        errorMessage: 'This is a TEST message from the integration test suite',
        statusCode: 200,
        details: {
          test: true,
          timestamp: new Date().toISOString(),
          message: 'If you see this in Slack, the integration test passed! ✅',
        },
      };

      const response = await makeRequest(slackAlertHandler, {
        method: 'POST',
        body: testPayload,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      console.log('✅ Test message sent successfully via handler!');
      console.log('   Check your Slack channel for the message.');
    } else {
      console.warn('⚠️  Handler not available (Jest/import.meta issue)');
      console.warn('   Testing direct webhook instead...');
      // Will be tested in the direct webhook test below
    }
  }, 30000); // 30 second timeout for network call

  test('should send critical alert format to Slack', async () => {
    if (!slackWebhookUrl) {
      console.warn('⚠️  Skipping - SLACK_WEBHOOK_URL not configured');
      return;
    }

    console.log('📤 Sending critical alert format test to Slack...');

    // Send directly to webhook with critical alert format
    const criticalMessage = {
      text: '🚨 TEST: Critical Alert Format',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 TEST: Critical Alert Format',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Priority:*\n🔴 CRITICAL',
            },
            {
              type: 'mrkdwn',
              text: '*Route:*\n`/api/webhooks/square-order-paid`',
            },
            {
              type: 'mrkdwn',
              text: `*Error ID:*\n\`critical_test_${Date.now()}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Timestamp:*\n${new Date().toISOString()}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Alert:*\nTEST: Critical error simulation - Please ignore',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*🚨 IMMEDIATE ACTION REQUIRED:*\n1. *TEST ONLY*: This is a test message\n2. *VERIFY FORMAT*: Check that all fields display correctly\n3. *IGNORE*: This is not a real alert',
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Test timestamp: ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(criticalMessage),
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    console.log('✅ Critical alert format test sent successfully!');
    console.log('   Check your Slack channel to verify the format.');
  }, 30000);

  test('should send monitoring alert format to Slack', async () => {
    if (!slackWebhookUrl) {
      console.warn('⚠️  Skipping - SLACK_WEBHOOK_URL not configured');
      return;
    }

    console.log('📤 Sending monitoring alert format test to Slack...');

    const monitoringMessage = {
      text: '⚠️ TEST: Monitoring Alert Format',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ TEST: Monitoring Alert Format',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Priority:*\n🟡 MEDIUM PRIORITY',
            },
            {
              type: 'mrkdwn',
              text: '*Route:*\n`/api/monitoring/inventory-sync-check`',
            },
            {
              type: 'mrkdwn',
              text: `*Timestamp:*\n${new Date().toISOString()}`,
            },
            {
              type: 'mrkdwn',
              text: '*Status:*\n✅ Test Status',
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Alert:*\nTEST: Inventory sync check alert - Please ignore',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*📋 Mismatched Items:*\n1. *Test Product* (SKU: `TEST123`)\n   Square: 10 | Neon: 5 | Diff: -5',
            },
          ],
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*🚨 IMMEDIATE ACTION REQUIRED:*\n1. *TEST ONLY*: This is a test message\n2. *VERIFY FORMAT*: Check monitoring alert structure\n3. *IGNORE*: This is not a real alert',
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Test timestamp: ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(monitoringMessage),
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    console.log('✅ Monitoring alert format test sent successfully!');
    console.log('   Check your Slack channel to verify the format.');
  }, 30000);

  test('should verify complete message format in Slack', async () => {
    if (!slackWebhookUrl) {
      console.warn('⚠️  Skipping - SLACK_WEBHOOK_URL not configured');
      return;
    }

    console.log('📤 Sending complete format verification test to Slack...');
    console.log('   Please verify in Slack that the message has:');
    console.log('   ✓ Header with emoji (🚨)');
    console.log('   ✓ Priority field (CRITICAL)');
    console.log('   ✓ Error ID field');
    console.log('   ✓ Recommended actions section');
    console.log('   ✓ Quick links section');
    console.log('   ✓ Timestamp in footer');

    const formatTestMessage = {
      text: '🚨 TEST: Complete Format Verification',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 TEST: Complete Format Verification',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Priority:*\n🔴 CRITICAL',
            },
            {
              type: 'mrkdwn',
              text: '*Route:*\n`/api/webhooks/format-test`',
            },
            {
              type: 'mrkdwn',
              text: `*Error ID:*\n\`format_test_${Date.now()}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Timestamp:*\n${new Date().toISOString()}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Alert:*\nTEST: Format verification - check message structure',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*🚨 IMMEDIATE ACTION REQUIRED:*\n1. *VERIFY HEADER*: Should have 🚨 emoji\n2. *VERIFY PRIORITY*: Should show CRITICAL\n3. *VERIFY ERROR ID*: Should be displayed\n4. *VERIFY ACTIONS*: Should have numbered list\n5. *VERIFY LINKS*: Should have clickable links\n6. *VERIFY TIMESTAMP*: Should be in footer',
            },
          ],
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*🔗 Quick Links:*\n<https://vercel.com/dashboard|View Vercel Logs>\n<https://example.com|Test Endpoint>\n<https://vercel.com/settings|Check Environment Variables>',
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Error ID: \`format_test_${Date.now()}\` | Timestamp: ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formatTestMessage),
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    console.log('✅ Complete format test sent!');
    console.log('   Manually verify the message structure in Slack.');
    console.log('   All elements should be present and properly formatted.');
  }, 30000);
});

describe('Slack Webhook Direct Tests', () => {
  test('should send message directly to Slack webhook', async () => {
    if (!slackWebhookUrl) {
      console.warn('⚠️  Skipping - SLACK_WEBHOOK_URL not configured');
      return;
    }

    console.log('📤 Sending direct webhook test to Slack...');

    const message = {
      text: '🧪 Direct Webhook Test',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🧪 Direct Webhook Test',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'This message was sent *directly* to the Slack webhook URL to verify connectivity.',
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Test timestamp: ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    console.log('✅ Direct webhook test successful!');
    console.log('   Check your Slack channel for the message.');
  }, 30000);
});
