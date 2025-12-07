/**
 * Test Monitoring Checks
 * 
 * Tests the inventory sync check and order reconciliation check endpoints.
 * 
 * Usage:
 *   node scripts/test-monitoring-checks.js
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function testInventorySyncCheck() {
  console.log('\n📦 Testing Inventory Sync Check...');
  console.log('='.repeat(60));
  
  try {
    // Test GET (check only, no alert)
    console.log('\n1️⃣  Testing GET /api/monitoring/inventory-sync-check (check only)...');
    const getResponse = await fetch(`${BASE_URL}/api/monitoring/inventory-sync-check`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error(`❌ GET request failed: ${getResponse.status}`);
      console.error(`   Response: ${errorText}`);
      return false;
    }
    
    const getData = await getResponse.json();
    console.log(`✅ GET request successful`);
    console.log(`   Status: ${getData.status}`);
    console.log(`   Total Checked: ${getData.totalChecked}`);
    console.log(`   Square Items: ${getData.squareItems}`);
    console.log(`   Neon Items: ${getData.neonItems}`);
    console.log(`   Mismatches: ${getData.mismatches}`);
    
    if (getData.mismatchesList && getData.mismatchesList.length > 0) {
      console.log(`\n   ⚠️  Mismatches found:`);
      getData.mismatchesList.slice(0, 5).forEach((m, i) => {
        console.log(`      ${i + 1}. ${m.name} (${m.square_variation_id})`);
        console.log(`         Square: ${m.square_count} | Neon: ${m.neon_count} | Diff: ${m.difference}`);
      });
      if (getData.mismatchesList.length > 5) {
        console.log(`      ...and ${getData.mismatchesList.length - 5} more`);
      }
    } else {
      console.log(`   ✅ No mismatches found (all inventories match)`);
    }
    
    // Test POST (check + alert)
    console.log('\n2️⃣  Testing POST /api/monitoring/inventory-sync-check (check + alert)...');
    const postResponse = await fetch(`${BASE_URL}/api/monitoring/inventory-sync-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error(`❌ POST request failed: ${postResponse.status}`);
      console.error(`   Response: ${errorText}`);
      return false;
    }
    
    const postData = await postResponse.json();
    console.log(`✅ POST request successful`);
    console.log(`   Status: ${postData.status}`);
    console.log(`   Mismatches: ${postData.mismatches}`);
    
    if (postData.mismatches > 0) {
      console.log(`   ⚠️  Alert sent to Slack (if configured)`);
    } else {
      console.log(`   ✅ Success message sent to Slack (if configured)`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error testing inventory sync check:`, error.message);
    return false;
  }
}

async function testOrderReconciliationCheck() {
  console.log('\n📋 Testing Order Reconciliation Check...');
  console.log('='.repeat(60));
  
  try {
    // Test GET (check only, no alert)
    console.log('\n1️⃣  Testing GET /api/monitoring/order-reconciliation-check (check only)...');
    const getResponse = await fetch(`${BASE_URL}/api/monitoring/order-reconciliation-check`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error(`❌ GET request failed: ${getResponse.status}`);
      console.error(`   Response: ${errorText}`);
      return false;
    }
    
    const getData = await getResponse.json();
    console.log(`✅ GET request successful`);
    console.log(`   Status: ${getData.status}`);
    console.log(`   Total Checked: ${getData.totalChecked}`);
    console.log(`   Square Orders: ${getData.squareOrders}`);
    console.log(`   Neon Orders: ${getData.neonOrders}`);
    console.log(`   Missing Orders: ${getData.missingOrders}`);
    
    if (getData.missingOrdersList && getData.missingOrdersList.length > 0) {
      console.log(`\n   ⚠️  Missing orders found:`);
      getData.missingOrdersList.slice(0, 5).forEach((order, i) => {
        const amount = (order.total_amount / 100).toFixed(2);
        console.log(`      ${i + 1}. ${order.order_number} (${order.square_order_id})`);
        console.log(`         Amount: $${amount} ${order.currency} | Date: ${new Date(order.created_at).toLocaleDateString()}`);
      });
      if (getData.missingOrdersList.length > 5) {
        console.log(`      ...and ${getData.missingOrdersList.length - 5} more`);
      }
    } else {
      console.log(`   ✅ No missing orders found (all orders reconciled)`);
    }
    
    // Test POST (check + alert)
    console.log('\n2️⃣  Testing POST /api/monitoring/order-reconciliation-check (check + alert)...');
    const postResponse = await fetch(`${BASE_URL}/api/monitoring/order-reconciliation-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error(`❌ POST request failed: ${postResponse.status}`);
      console.error(`   Response: ${errorText}`);
      return false;
    }
    
    const postData = await postResponse.json();
    console.log(`✅ POST request successful`);
    console.log(`   Status: ${postData.status}`);
    console.log(`   Missing Orders: ${postData.missingOrders}`);
    
    if (postData.missingOrders > 0) {
      console.log(`   ⚠️  Alert sent to Slack (if configured)`);
    } else {
      console.log(`   ✅ Success message sent to Slack (if configured)`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error testing order reconciliation check:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🧪 Testing Monitoring Checks');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  const results = {
    inventorySync: false,
    orderReconciliation: false,
  };
  
  // Test inventory sync check
  results.inventorySync = await testInventorySyncCheck();
  
  // Test order reconciliation check
  results.orderReconciliation = await testOrderReconciliationCheck();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`Inventory Sync Check: ${results.inventorySync ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Order Reconciliation Check: ${results.orderReconciliation ? '✅ PASSED' : '❌ FAILED'}`);
  
  const allPassed = results.inventorySync && results.orderReconciliation;
  console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (!allPassed) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Test script error:', error);
  process.exit(1);
});

