#!/usr/bin/env node
/**
 * Sync stock count from Square to match Square's current inventory
 * 
 * Usage:
 *   node scripts/sync-stock-from-square.js [variation-id] [square-stock-count]
 * 
 * Example:
 *   node scripts/sync-stock-from-square.js 4WVYFT2GBQA3PDPEHVZC3ENU 10
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
const squareStockCount = process.argv[3];

if (!variationId || !squareStockCount) {
  console.error('❌ Please provide variation ID and Square stock count');
  console.error('Usage: node scripts/sync-stock-from-square.js [variation-id] [square-stock-count]');
  console.error('Example: node scripts/sync-stock-from-square.js 4WVYFT2GBQA3PDPEHVZC3ENU 10');
  process.exit(1);
}

const newStock = parseInt(squareStockCount, 10);
if (isNaN(newStock)) {
  console.error('❌ Invalid stock count. Must be a number.');
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

async function syncStock() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get current stock
    const currentResult = await client.query(`
      SELECT id, name, stock_count 
      FROM products 
      WHERE id = $1
    `, [variationId]);
    
    if (currentResult.rows.length === 0) {
      console.error(`❌ Product not found: ${variationId}`);
      console.error('   Run "npm run square:fetch" to sync products from Square');
      await client.query('ROLLBACK');
      return;
    }
    
    const current = currentResult.rows[0];
    const currentStock = current.stock_count || 0;
    const change = newStock - currentStock;
    
    console.log('🔄 Syncing Stock from Square');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Product: ${current.name || variationId}`);
    console.log(`Current DB Stock: ${currentStock}`);
    console.log(`Square Stock: ${newStock}`);
    console.log(`Change: ${change > 0 ? '+' : ''}${change}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Execute optimized SQL UPDATE query
    const updateResult = await client.query(`
      UPDATE products 
      SET stock_count = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, stock_count, updated_at
    `, [newStock, variationId]);
    
    if (updateResult.rows.length === 0) {
      console.error('❌ Failed to update product');
      await client.query('ROLLBACK');
      return;
    }
    
    const updated = updateResult.rows[0];
    
    // Create inventory record for the sync (audit trail only)
    // NOTE: We do NOT want the trigger to fire and modify stock_count again,
    // since we already updated it directly above. The trigger would double-count.
    // So we insert with quantity_change = 0 to create an audit record without triggering stock update.
    if (change !== 0) {
      // Insert with quantity_change = 0 to avoid trigger firing
      // The trigger updates stock_count by ADDING quantity_change, which would double-count
      await client.query(`
        INSERT INTO inventory (product_id, quantity_change, reason, notes, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        variationId,
        0, // Set to 0 to prevent trigger from modifying stock_count (already updated above)
        'manual_sync',
        `Manual sync from Square. Previous: ${currentStock}, Square: ${newStock} (change: ${change > 0 ? '+' : ''}${change})`
      ]);
    }
    
    await client.query('COMMIT');
    
    console.log('✅ Stock synced successfully!');
    console.log(`   Updated: ${current.name || variationId}`);
    console.log(`   New Stock: ${updated.stock_count}`);
    console.log(`   Updated At: ${updated.updated_at}`);
    console.log('\n💡 Now test the webhook:');
    console.log('   1. Change stock in Square Dashboard');
    console.log('   2. Wait 5-10 seconds');
    console.log('   3. Run: npm run inventory:check', variationId);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

syncStock();

