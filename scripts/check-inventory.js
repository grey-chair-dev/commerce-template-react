#!/usr/bin/env node
/**
 * Check inventory for a specific product
 * 
 * Usage:
 *   node scripts/check-inventory.js [variation-id]
 * 
 * Example:
 *   node scripts/check-inventory.js 4WVYFT2GBQA3PDPEHVZC3ENU
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
const { Pool } = pg;

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const variationId = process.argv[2];

if (!variationId) {
  console.error('❌ Please provide a variation ID');
  console.error('Usage: node scripts/check-inventory.js [variation-id]');
  process.exit(1);
}

// Get database URL
const databaseUrl = process.env.SPR_NEON_DATABSE_URL || 
                    process.env.DATABASE_URL || 
                    process.env.SPR_POSTGRES_URL ||
                    process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error('❌ Database URL not configured');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});

async function checkInventory() {
  const client = await pool.connect();
  
  try {
    // Get current stock
    const productResult = await client.query(`
      SELECT 
        id,
        name,
        stock_count,
        updated_at
      FROM products 
      WHERE id = $1
    `, [variationId]);
    
    if (productResult.rows.length === 0) {
      console.log(`❌ Product not found: ${variationId}`);
      console.log('   Run "npm run square:fetch" to sync products from Square');
      return;
    }
    
    const product = productResult.rows[0];
    
    // Get recent inventory changes
    const inventoryResult = await client.query(`
      SELECT 
        quantity_change,
        reason,
        notes,
        created_at
      FROM inventory
      WHERE product_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [variationId]);
    
    console.log('📦 Current Inventory Status');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Product ID: ${product.id}`);
    console.log(`Name: ${product.name || 'N/A'}`);
    console.log(`Current Stock: ${product.stock_count}`);
    console.log(`Last Updated: ${product.updated_at}`);
    console.log('\n📊 Recent Inventory Changes:');
    
    if (inventoryResult.rows.length === 0) {
      console.log('   No inventory changes recorded yet');
    } else {
      inventoryResult.rows.forEach((row, i) => {
        const change = row.quantity_change > 0 ? `+${row.quantity_change}` : `${row.quantity_change}`;
        console.log(`   ${i + 1}. ${change} (${row.reason}) - ${row.created_at}`);
        if (row.notes) {
          console.log(`      ${row.notes}`);
        }
      });
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 To test:');
    console.log('   1. Change stock for this product in Square Dashboard');
    console.log('   2. Wait a few seconds for webhook to process');
    console.log('   3. Run this script again to see the updated stock');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

checkInventory();

