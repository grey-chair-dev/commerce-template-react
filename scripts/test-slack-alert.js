/**
 * Test Slack Alert System
 * 
 * Tests the Slack alert handler to verify it's working correctly
 * 
 * Usage:
 *   node scripts/test-slack-alert.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const baseUrl = process.env.VITE_API_URL || 'http://localhost:3000';
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

async function testSlackAlert() {
  console.log('🧪 Testing Slack Alert System');
  console.log('='.repeat(60));
  
  if (!slackWebhookUrl) {
    console.error('❌ SLACK_WEBHOOK_URL not configured in .env.local');
    console.error('   Add: SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...');
    process.exit(1);
  }
  
  console.log(`\n✅ Slack webhook URL found`);
  console.log(`   URL: ${slackWebhookUrl.substring(0, 50)}...`);
  
  // Test data
  const testPayload = {
    route: '/api/webhooks/square-inventory',
    errorId: `test_err_${Date.now()}`,
    timestamp: new Date().toISOString(),
    errorMessage: 'This is a test error message to verify Slack alerts are working',
    statusCode: 500,
  };
  
  console.log(`\n📤 Sending test alert to Slack...`);
  console.log(`   Route: ${testPayload.route}`);
  console.log(`   Error ID: ${testPayload.errorId}`);
  console.log(`   Timestamp: ${testPayload.timestamp}`);
  
  try {
    const response = await fetch(`${baseUrl}/api/webhooks/slack-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });
    
    const data = await response.json().catch(() => ({}));
    
    if (response.status === 200 && data.success) {
      console.log(`\n✅ Test alert sent successfully!`);
      console.log(`   Check your Slack channel for the alert message`);
      console.log(`   You should see:`);
      console.log(`   - Route: ${testPayload.route}`);
      console.log(`   - Status Code: ${testPayload.statusCode}`);
      console.log(`   - Timestamp: ${testPayload.timestamp}`);
      console.log(`   - Error ID: ${testPayload.errorId}`);
      return true;
    } else {
      console.error(`\n❌ Test failed: ${response.status}`);
      console.error(`   Response:`, data);
      return false;
    }
  } catch (error) {
    console.error(`\n❌ Test failed:`, error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error(`   Make sure Vercel dev server is running:`);
      console.error(`   vercel dev --listen 3000`);
    }
    return false;
  }
}

testSlackAlert().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

