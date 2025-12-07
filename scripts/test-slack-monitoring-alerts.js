/**
 * Test Slack Monitoring Alerts
 * 
 * Tests that the monitoring endpoints send Slack alerts correctly.
 * 
 * Usage:
 *   node scripts/test-slack-monitoring-alerts.js
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env.local') });

const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function testInventorySyncSlackAlert() {
  console.log('\n📦 Testing Inventory Sync Check Slack Alert...');
  console.log('='.repeat(60));
  
  try {
    console.log('\nSending POST request to trigger Slack alert...');
    const response = await fetch(`${BASE_URL}/api/monitoring/inventory-sync-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error(`❌ Request failed: ${response.status}`);
      console.error(`   Error: ${errorData.error || errorData.message || errorText}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ Request successful`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Total Checked: ${data.totalChecked}`);
    console.log(`   Mismatches: ${data.mismatches}`);
    
    if (data.mismatches > 0) {
      console.log(`\n   ⚠️  Alert should have been sent to Slack with ${data.mismatches} mismatches`);
      console.log(`   Check your Slack channel for the alert!`);
    } else {
      console.log(`\n   ✅ Success message should have been sent to Slack`);
      console.log(`   Check your Slack channel for the "Daily Sync Check Passed" message!`);
    }
    
    console.log(`\n   📋 Check Slack channel: ${process.env.SLACK_WEBHOOK_URL ? 'Configured' : 'NOT CONFIGURED'}`);
    if (!process.env.SLACK_WEBHOOK_URL) {
      console.log(`   ⚠️  SLACK_WEBHOOK_URL not found in environment variables`);
      console.log(`   The endpoint will skip sending alerts if not configured`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error testing inventory sync Slack alert:`, error.message);
    return false;
  }
}

async function testOrderReconciliationSlackAlert() {
  console.log('\n📋 Testing Order Reconciliation Check Slack Alert...');
  console.log('='.repeat(60));
  
  try {
    console.log('\nSending POST request to trigger Slack alert...');
    const response = await fetch(`${BASE_URL}/api/monitoring/order-reconciliation-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error(`❌ Request failed: ${response.status}`);
      console.error(`   Error: ${errorData.error || errorData.message || errorText}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ Request successful`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Total Checked: ${data.totalChecked}`);
    console.log(`   Missing Orders: ${data.missingOrders}`);
    
    if (data.missingOrders > 0) {
      console.log(`\n   ⚠️  Alert should have been sent to Slack with ${data.missingOrders} missing orders`);
      console.log(`   Check your Slack channel for the alert!`);
    } else {
      console.log(`\n   ✅ Success message should have been sent to Slack`);
      console.log(`   Check your Slack channel for the "Daily Sync Check Passed" message!`);
    }
    
    console.log(`\n   📋 Check Slack channel: ${process.env.SLACK_WEBHOOK_URL ? 'Configured' : 'NOT CONFIGURED'}`);
    if (!process.env.SLACK_WEBHOOK_URL) {
      console.log(`   ⚠️  SLACK_WEBHOOK_URL not found in environment variables`);
      console.log(`   The endpoint will skip sending alerts if not configured`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error testing order reconciliation Slack alert:`, error.message);
    return false;
  }
}

async function testNeonHealthSlackAlert() {
  console.log('\n💚 Testing Neon Health Check Slack Alert...');
  console.log('='.repeat(60));
  
  try {
    console.log('\nSending POST request to trigger Slack alert (if thresholds breached)...');
    const response = await fetch(`${BASE_URL}/api/monitoring/neon-health`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error(`❌ Request failed: ${response.status}`);
      console.error(`   Error: ${errorData.error || errorData.message || errorText}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ Request successful`);
    console.log(`   Overall Status: ${data.overall}`);
    console.log(`   Connection Pool: ${data.connectionPool?.percentage || 'N/A'}% (${data.connectionPool?.status || 'N/A'})`);
    console.log(`   Query Latency: ${data.queryLatency?.latencyMs || 'N/A'}ms (${data.queryLatency?.status || 'N/A'})`);
    console.log(`   Alerts: ${data.alerts?.length || 0}`);
    
    if (data.alerts && data.alerts.length > 0) {
      console.log(`\n   ⚠️  ${data.alerts.length} alert(s) should have been sent to Slack`);
      data.alerts.forEach((alert, i) => {
        console.log(`   ${i + 1}. ${alert.resource}: ${alert.message}`);
      });
      console.log(`   Check your Slack channel for the alerts!`);
    } else {
      console.log(`\n   ✅ No alerts triggered (all metrics within thresholds)`);
      console.log(`   No Slack message sent (alerts only sent when thresholds are breached)`);
    }
    
    console.log(`\n   📋 Check Slack channel: ${process.env.SLACK_WEBHOOK_URL ? 'Configured' : 'NOT CONFIGURED'}`);
    if (!process.env.SLACK_WEBHOOK_URL) {
      console.log(`   ⚠️  SLACK_WEBHOOK_URL not found in environment variables`);
      console.log(`   The endpoint will skip sending alerts if not configured`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error testing Neon health Slack alert:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🧪 Testing Slack Monitoring Alerts');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`\n⚠️  Note: This will send actual alerts to Slack if configured!`);
  
  // Check if Slack webhook is configured
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  if (!slackWebhook) {
    console.log(`\n⚠️  WARNING: SLACK_WEBHOOK_URL not found in environment`);
    console.log(`   Alerts will not be sent. Add SLACK_WEBHOOK_URL to .env.local to test.`);
  } else {
    console.log(`\n✅ SLACK_WEBHOOK_URL found - alerts will be sent to Slack`);
  }
  
  const results = {
    inventorySync: false,
    orderReconciliation: false,
    neonHealth: false,
  };
  
  // Test inventory sync Slack alert
  results.inventorySync = await testInventorySyncSlackAlert();
  
  // Test order reconciliation Slack alert
  results.orderReconciliation = await testOrderReconciliationSlackAlert();
  
  // Test Neon health Slack alert
  results.neonHealth = await testNeonHealthSlackAlert();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`Inventory Sync Slack Alert: ${results.inventorySync ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Order Reconciliation Slack Alert: ${results.orderReconciliation ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Neon Health Slack Alert: ${results.neonHealth ? '✅ PASSED' : '❌ FAILED'}`);
  
  const allPassed = results.inventorySync && results.orderReconciliation && results.neonHealth;
  console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (slackWebhook) {
    console.log(`\n📬 Check your Slack channel for the alert messages!`);
  } else {
    console.log(`\n⚠️  No Slack alerts were sent (SLACK_WEBHOOK_URL not configured)`);
  }
  
  if (!allPassed) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Test script error:', error);
  process.exit(1);
});

