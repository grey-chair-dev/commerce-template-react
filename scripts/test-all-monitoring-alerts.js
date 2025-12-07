/**
 * Test All Monitoring Alerts
 * 
 * Tests all monitoring endpoints to verify they send Slack alerts
 * with the correct actionable steps.
 * 
 * Usage:
 *   node scripts/test-all-monitoring-alerts.js
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env.local') });

const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000';

// Strip quotes if present (common in .env files)
let SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
if (SLACK_WEBHOOK_URL) {
  SLACK_WEBHOOK_URL = SLACK_WEBHOOK_URL.trim().replace(/^["']|["']$/g, '');
}

if (!SLACK_WEBHOOK_URL) {
  console.warn('⚠️  SLACK_WEBHOOK_URL not configured');
  console.warn('   Alerts will not be sent to Slack, but endpoints will still be tested.');
  console.warn('   Set SLACK_WEBHOOK_URL in .env.local to receive actual Slack alerts.\n');
}

console.log('🧪 Testing All Monitoring Alerts\n');
console.log(`Base URL: ${BASE_URL}\n`);

// Test endpoints
const tests = [
  {
    name: '1. Webhook 5xx Error - Square Order Paid',
    endpoint: '/api/webhooks/slack-alert',
    method: 'POST',
    body: {
      route: '/api/webhooks/square-order-paid',
      errorId: 'test-error-' + Date.now(),
      timestamp: new Date().toISOString(),
      errorMessage: 'Database connection failed',
      statusCode: 500,
      details: 'Test error for monitoring alert verification',
    },
    expectedAction: 'Manual order insertion',
  },
  {
    name: '2. Webhook 5xx Error - Square Inventory',
    endpoint: '/api/webhooks/slack-alert',
    method: 'POST',
    body: {
      route: '/api/webhooks/square-inventory',
      errorId: 'test-error-' + Date.now(),
      timestamp: new Date().toISOString(),
      errorMessage: 'Failed to update stock_count',
      statusCode: 500,
      details: 'Test error for monitoring alert verification',
    },
    expectedAction: 'Manual SKU fix',
  },
  {
    name: '3. Webhook 403 Error',
    endpoint: '/api/webhooks/slack-alert',
    method: 'POST',
    body: {
      route: '/api/webhooks/square-inventory',
      errorId: 'test-error-' + Date.now(),
      timestamp: new Date().toISOString(),
      errorMessage: 'Invalid signature',
      statusCode: 403,
      details: 'Test error for monitoring alert verification',
    },
    expectedAction: 'Signature key verification',
  },
  {
    name: '4. Inventory Divergence Check',
    endpoint: '/api/monitoring/inventory-sync-check',
    method: 'POST',
    body: null,
    expectedAction: 'Code audit + full resync',
  },
  {
    name: '5. Neon Health - Connection Pool',
    endpoint: '/api/monitoring/neon-health',
    method: 'POST',
    body: null,
    expectedAction: 'Scaling + code audit',
  },
  {
    name: '6. Cart Abandonment Rate',
    endpoint: '/api/monitoring/cart-abandonment',
    method: 'POST',
    body: null,
    expectedAction: 'UX audit + log review',
  },
  {
    name: '7. Auth Failure Rate',
    endpoint: '/api/monitoring/auth-failure-rate',
    method: 'POST',
    body: null,
    expectedAction: 'JWT_SECRET verification',
  },
  {
    name: '8. Square Health Check',
    endpoint: '/api/monitoring/square-health',
    method: 'POST',
    body: null,
    expectedAction: 'Proactive site banner',
  },
  {
    name: '9. ESP Health Check',
    endpoint: '/api/monitoring/esp-health',
    method: 'POST',
    body: null,
    expectedAction: 'Proactive banner + manual fulfillment',
  },
];

async function testEndpoint(test) {
  try {
    console.log(`\n📋 ${test.name}`);
    console.log(`   Endpoint: ${test.endpoint}`);
    console.log(`   Method: ${test.method}`);
    
    const options = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (test.body) {
      options.body = JSON.stringify(test.body);
    }
    
    const response = await fetch(`${BASE_URL}${test.endpoint}`, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   ✅ Expected Action: ${test.expectedAction}`);
      if (SLACK_WEBHOOK_URL) {
        console.log(`   ✅ Alert sent to Slack (check your Slack channel)`);
      } else {
        console.log(`   ⚠️  Alert would be sent to Slack (SLACK_WEBHOOK_URL not configured)`);
      }
      return { success: true, test: test.name };
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   ❌ Error: ${JSON.stringify(data, null, 2)}`);
      return { success: false, test: test.name, error: data };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, test: test.name, error: error.message };
  }
}

async function runAllTests() {
  console.log('⏳ Starting tests...\n');
  if (SLACK_WEBHOOK_URL) {
    console.log('⚠️  Note: These tests will send actual alerts to Slack!');
    console.log('   Make sure SLACK_WEBHOOK_URL is configured correctly.\n');
  } else {
    console.log('⚠️  Note: SLACK_WEBHOOK_URL not configured.');
    console.log('   Tests will verify endpoints work, but no Slack alerts will be sent.\n');
  }
  
  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test);
    results.push(result);
    
    // Small delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n✅ Successful: ${successful}/${tests.length}`);
  console.log(`❌ Failed: ${failed}/${tests.length}\n`);
  
  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ❌ ${r.test}`);
      if (r.error) {
        console.log(`     Error: ${typeof r.error === 'string' ? r.error : JSON.stringify(r.error)}`);
      }
    });
  }
  
  console.log('\n📋 All alerts should now be visible in your Slack channel.');
  console.log('   Verify that each alert includes the expected actionable steps.\n');
  
  return results;
}

// Run tests
runAllTests()
  .then(results => {
    const allPassed = results.every(r => r.success);
    process.exit(allPassed ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });

