/**
 * Test Monitoring Debug Endpoint
 * 
 * Quick script to test the debug endpoint and view configuration.
 * 
 * Usage:
 *   node scripts/test-monitoring-debug.js
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function main() {
  console.log('🔍 Testing Monitoring Debug Endpoint');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);
  
  try {
    // Get debug information
    console.log('📋 Fetching debug information...\n');
    const response = await fetch(`${BASE_URL}/api/monitoring/debug`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Request failed: ${response.status}`);
      console.error(`   ${errorText}`);
      return;
    }
    
    const data = await response.json();
    
    // Display configuration
    console.log('⚙️  Configuration Status:');
    console.log('─'.repeat(60));
    console.log(`Environment: ${data.configuration.environment.nodeEnv}`);
    console.log(`Vercel: ${data.configuration.environment.vercel ? 'Yes' : 'No'}`);
    console.log(`Vercel URL: ${data.configuration.environment.vercelUrl}`);
    console.log('');
    console.log(`Slack Webhook: ${data.configuration.slack.webhookUrl}`);
    console.log(`  Source: ${data.configuration.slack.source}`);
    console.log('');
    console.log(`Square Access Token: ${data.configuration.square.accessToken}`);
    console.log(`Square Location ID: ${data.configuration.square.locationId}`);
    console.log(`Square Environment: ${data.configuration.square.environment}`);
    console.log('');
    console.log(`Database URL: ${data.configuration.database.url}`);
    console.log(`  Source: ${data.configuration.database.source}`);
    console.log('');
    
    // Display test results
    console.log('🧪 Connection Tests:');
    console.log('─'.repeat(60));
    console.log(`Database: ${data.tests.database.success ? '✅' : '❌'} ${data.tests.database.success ? data.tests.database.message : data.tests.database.error}`);
    if (data.tests.database.success && data.tests.database.details) {
      console.log(`  Current Time: ${data.tests.database.details.currentTime}`);
    }
    console.log('');
    console.log(`Square API: ${data.tests.square.success ? '✅' : '❌'} ${data.tests.square.success ? data.tests.square.message : data.tests.square.error}`);
    if (data.tests.square.success && data.tests.square.details) {
      console.log(`  Environment: ${data.tests.square.details.environment}`);
      console.log(`  Locations Found: ${data.tests.square.details.locationsFound}`);
    }
    console.log('');
    
    // Display available endpoints
    console.log('📡 Available Endpoints:');
    console.log('─'.repeat(60));
    Object.entries(data.endpoints).forEach(([key, endpoint]) => {
      console.log(`  ${key}: ${endpoint}`);
    });
    console.log('');
    
    // Display usage
    console.log('💡 Usage:');
    console.log('─'.repeat(60));
    console.log(`  GET ${BASE_URL}/api/monitoring/debug`);
    console.log(`     - View configuration and test results`);
    console.log('');
    console.log(`  POST ${BASE_URL}/api/monitoring/debug`);
    console.log(`     Body: { "action": "test-slack" }`);
    console.log(`     - Test Slack webhook`);
    console.log('');
    console.log(`  POST ${BASE_URL}/api/monitoring/debug`);
    console.log(`     Body: { "action": "test-database" }`);
    console.log(`     - Test database connection`);
    console.log('');
    console.log(`  POST ${BASE_URL}/api/monitoring/debug`);
    console.log(`     Body: { "action": "test-square" }`);
    console.log(`     - Test Square API connection`);
    console.log('');
    console.log(`  POST ${BASE_URL}/api/monitoring/debug`);
    console.log(`     Body: { "action": "test-inventory" }`);
    console.log(`     - Run inventory sync check`);
    console.log('');
    console.log(`  POST ${BASE_URL}/api/monitoring/debug`);
    console.log(`     Body: { "action": "test-orders" }`);
    console.log(`     - Run order reconciliation check`);
    console.log('');
    console.log(`  POST ${BASE_URL}/api/monitoring/debug`);
    console.log(`     Body: { "action": "test-neon" }`);
    console.log(`     - Run Neon health check`);
    console.log('');
    
    // Test Slack webhook
    console.log('📬 Testing Slack webhook...');
    console.log('─'.repeat(60));
    const slackTestResponse = await fetch(`${BASE_URL}/api/monitoring/debug`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'test-slack' }),
    });
    
    const slackTestData = await slackTestResponse.json();
    if (slackTestData.success) {
      console.log(`✅ ${slackTestData.message}`);
      console.log(`   Check your Slack channel for the test message!`);
    } else {
      console.log(`❌ ${slackTestData.error || 'Failed'}`);
      if (slackTestData.details) {
        console.log(`   Details: ${slackTestData.details}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

