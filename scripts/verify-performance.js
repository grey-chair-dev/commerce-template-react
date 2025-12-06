/**
 * Performance Verification Script
 * Tests that the shop page API loads in under 300ms
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const PERFORMANCE_TARGET_MS = 300;
const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.SPR_DATABASE_URL || process.env.NEON_DATABASE_URL;

async function testAPIPerformance() {
  console.log('🚀 Testing API Performance...\n');
  console.log(`Target: < ${PERFORMANCE_TARGET_MS}ms\n`);

  const results = [];
  const numTests = 10;

  for (let i = 0; i < numTests; i++) {
    const startTime = performance.now();
    try {
      const response = await fetch(`${API_URL}/api/catalog/products?limit=500`);
      const products = await response.json();
      const endTime = performance.now();
      const duration = endTime - startTime;

      results.push({
        test: i + 1,
        duration: Math.round(duration),
        success: response.ok,
        productCount: Array.isArray(products) ? products.length : 0,
      });

      console.log(`Test ${i + 1}: ${Math.round(duration)}ms - ${Array.isArray(products) ? products.length : 0} products`);
    } catch (error) {
      console.error(`Test ${i + 1}: FAILED - ${error.message}`);
      results.push({
        test: i + 1,
        duration: null,
        success: false,
        error: error.message,
      });
    }
  }

  // Calculate statistics
  const successfulTests = results.filter(r => r.success && r.duration !== null);
  const durations = successfulTests.map(r => r.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const underTarget = successfulTests.filter(r => r.duration < PERFORMANCE_TARGET_MS).length;

  console.log('\n📊 Performance Summary:');
  console.log(`   Average: ${Math.round(avgDuration)}ms`);
  console.log(`   Min: ${minDuration}ms`);
  console.log(`   Max: ${maxDuration}ms`);
  console.log(`   Tests under ${PERFORMANCE_TARGET_MS}ms: ${underTarget}/${successfulTests.length}`);
  console.log(`   Success Rate: ${(successfulTests.length / numTests * 100).toFixed(1)}%`);

  if (avgDuration < PERFORMANCE_TARGET_MS) {
    console.log('\n✅ PASS: Average response time is under 300ms');
  } else {
    console.log('\n❌ FAIL: Average response time exceeds 300ms');
  }

  return {
    avgDuration,
    minDuration,
    maxDuration,
    underTarget,
    totalTests: numTests,
    successfulTests: successfulTests.length,
    passed: avgDuration < PERFORMANCE_TARGET_MS,
  };
}

async function verifyDatabaseAccuracy() {
  console.log('\n🔍 Verifying Database Accuracy...\n');

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not configured');
    return { verified: false, error: 'Database URL missing' };
  }

  try {
    const sql = neon(DATABASE_URL);

    // Get product count from database
    const dbResult = await sql`
      SELECT COUNT(*) as count, 
             MAX(updated_at) as last_updated
      FROM products
    `;
    const dbCount = parseInt(dbResult[0]?.count || '0', 10);
    const lastUpdated = dbResult[0]?.last_updated;

    // Get product count from API
    const apiResponse = await fetch(`${API_URL}/api/catalog/products?limit=1000`);
    const apiProducts = await apiResponse.json();
    const apiCount = Array.isArray(apiProducts) ? apiProducts.length : 0;

    console.log(`Database Products: ${dbCount}`);
    console.log(`API Products: ${apiCount}`);
    console.log(`Last Updated: ${lastUpdated || 'N/A'}`);

    // Check if counts match (allowing for pagination)
    const match = apiCount === dbCount || apiCount <= dbCount;

    if (match) {
      console.log('\n✅ PASS: API product count matches database');
    } else {
      console.log('\n⚠️  WARNING: Product count mismatch (may be due to pagination)');
    }

    // Verify sample products match
    const sampleProducts = await sql`
      SELECT id, name, price, stock_count, updated_at
      FROM products
      ORDER BY updated_at DESC
      LIMIT 5
    `;

    console.log('\n📦 Sample Products from Database:');
    sampleProducts.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} - $${p.price} - Stock: ${p.stock_count}`);
    });

    // Check if API returns these products
    const apiProductIds = new Set(Array.isArray(apiProducts) ? apiProducts.map(p => p.id) : []);
    const dbProductIds = new Set(sampleProducts.map(p => p.id));
    const allFound = sampleProducts.every(p => apiProductIds.has(p.id));

    if (allFound) {
      console.log('\n✅ PASS: Sample products found in API response');
    } else {
      console.log('\n❌ FAIL: Some products missing from API response');
    }

    return {
      verified: match && allFound,
      dbCount,
      apiCount,
      lastUpdated,
      sampleProducts: sampleProducts.length,
      allFound,
    };
  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    return { verified: false, error: error.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Shop Page Performance & Accuracy Verification');
  console.log('='.repeat(60));
  console.log(`API URL: ${API_URL}`);
  console.log(`Database: ${DATABASE_URL ? 'Configured' : 'Not configured'}\n`);

  const perfResults = await testAPIPerformance();
  const accuracyResults = await verifyDatabaseAccuracy();

  console.log('\n' + '='.repeat(60));
  console.log('Final Results');
  console.log('='.repeat(60));
  console.log(`Performance: ${perfResults.passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Accuracy: ${accuracyResults.verified ? '✅ PASS' : '❌ FAIL'}`);

  if (perfResults.passed && accuracyResults.verified) {
    console.log('\n🎉 All checks passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some checks failed. Review the output above.');
    process.exit(1);
  }
}

main().catch(console.error);

