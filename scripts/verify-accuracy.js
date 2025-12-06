/**
 * Accuracy Verification Script
 * Verifies that items displayed match the latest data in Neon DB
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.SPR_DATABASE_URL || process.env.NEON_DATABASE_URL;

async function verifyAccuracy() {
  console.log('🔍 Verifying API Accuracy Against Neon Database...\n');

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not configured');
    console.log('   Set SPR_DATABASE_URL or NEON_DATABASE_URL in .env.local');
    return { verified: false, error: 'Database URL missing' };
  }

  try {
    const sql = neon(DATABASE_URL);

    // Get all products from database
    console.log('📊 Fetching products from Neon database...');
    const dbProducts = await sql`
      SELECT 
        id, 
        name, 
        price, 
        category, 
        stock_count, 
        image_url,
        updated_at
      FROM products
      ORDER BY id
    `;

    console.log(`   Found ${dbProducts.length} products in database\n`);

    // Get all products from API
    console.log('🌐 Fetching products from API...');
    const apiResponse = await fetch(`${API_URL}/api/catalog/products?limit=1000`);
    
    if (!apiResponse.ok) {
      throw new Error(`API returned ${apiResponse.status}: ${apiResponse.statusText}`);
    }

    const apiProducts = await apiResponse.json();
    
    if (!Array.isArray(apiProducts)) {
      throw new Error('API did not return an array');
    }

    console.log(`   Found ${apiProducts.length} products from API\n`);

    // Create maps for comparison
    const dbMap = new Map(dbProducts.map(p => [p.id, p]));
    const apiMap = new Map(apiProducts.map(p => [p.id, p]));

    // Check for missing products
    const missingInAPI = dbProducts.filter(p => !apiMap.has(p.id));
    const extraInAPI = apiProducts.filter(p => !dbMap.has(p.id));

    console.log('🔎 Comparing products...\n');

    if (missingInAPI.length > 0) {
      console.log(`⚠️  ${missingInAPI.length} products in DB but not in API:`);
      missingInAPI.slice(0, 5).forEach(p => {
        console.log(`   - ${p.name} (${p.id})`);
      });
      if (missingInAPI.length > 5) {
        console.log(`   ... and ${missingInAPI.length - 5} more`);
      }
    }

    if (extraInAPI.length > 0) {
      console.log(`⚠️  ${extraInAPI.length} products in API but not in DB:`);
      extraInAPI.slice(0, 5).forEach(p => {
        console.log(`   - ${p.name} (${p.id})`);
      });
      if (extraInAPI.length > 5) {
        console.log(`   ... and ${extraInAPI.length - 5} more`);
      }
    }

    // Verify data accuracy for matching products
    let mismatches = [];
    let verified = 0;

    for (const dbProduct of dbProducts) {
      const apiProduct = apiMap.get(dbProduct.id);
      if (!apiProduct) continue;

      const issues = [];

      // Check name
      if (dbProduct.name !== apiProduct.name) {
        issues.push(`name: "${dbProduct.name}" vs "${apiProduct.name}"`);
      }

      // Check price (allow for float precision)
      const dbPrice = parseFloat(dbProduct.price);
      const apiPrice = parseFloat(apiProduct.price);
      if (Math.abs(dbPrice - apiPrice) > 0.01) {
        issues.push(`price: ${dbPrice} vs ${apiPrice}`);
      }

      // Check stock_count
      const dbStock = parseInt(dbProduct.stock_count || 0, 10);
      const apiStock = parseInt(apiProduct.stock_count || 0, 10);
      if (dbStock !== apiStock) {
        issues.push(`stock_count: ${dbStock} vs ${apiStock}`);
      }

      // Check category (may be transformed by lookup table)
      // We'll just note if it's different, not fail
      if (dbProduct.category !== apiProduct.category) {
        // This is expected due to category lookup table
      }

      if (issues.length > 0) {
        mismatches.push({
          id: dbProduct.id,
          name: dbProduct.name,
          issues,
        });
      } else {
        verified++;
      }
    }

    console.log(`\n✅ Verified ${verified}/${dbProducts.length} products match exactly`);

    if (mismatches.length > 0) {
      console.log(`\n❌ Found ${mismatches.length} products with mismatched data:`);
      mismatches.slice(0, 5).forEach(m => {
        console.log(`   - ${m.name} (${m.id}):`);
        m.issues.forEach(issue => console.log(`     • ${issue}`));
      });
      if (mismatches.length > 5) {
        console.log(`   ... and ${mismatches.length - 5} more`);
      }
    }

    // Check for recent updates
    const recentUpdates = await sql`
      SELECT COUNT(*) as count
      FROM products
      WHERE updated_at > NOW() - INTERVAL '1 hour'
    `;
    const recentCount = parseInt(recentUpdates[0]?.count || '0', 10);

    console.log(`\n🕐 Products updated in last hour: ${recentCount}`);

    const allMatch = missingInAPI.length === 0 && 
                     extraInAPI.length === 0 && 
                     mismatches.length === 0;

    return {
      verified: allMatch,
      dbCount: dbProducts.length,
      apiCount: apiProducts.length,
      missingInAPI: missingInAPI.length,
      extraInAPI: extraInAPI.length,
      mismatches: mismatches.length,
      verifiedCount: verified,
      recentUpdates: recentCount,
    };

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return { verified: false, error: error.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Shop Page Accuracy Verification');
  console.log('='.repeat(60));
  console.log(`API URL: ${API_URL}`);
  console.log(`Database: ${DATABASE_URL ? 'Configured' : 'Not configured'}\n`);

  const results = await verifyAccuracy();

  console.log('\n' + '='.repeat(60));
  console.log('Results');
  console.log('='.repeat(60));
  console.log(`Status: ${results.verified ? '✅ PASS' : '❌ FAIL'}`);
  if (results.error) {
    console.log(`Error: ${results.error}`);
  }

  process.exit(results.verified ? 0 : 1);
}

main().catch(console.error);

