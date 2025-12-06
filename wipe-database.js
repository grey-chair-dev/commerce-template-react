#!/usr/bin/env node
/**
 * Database Wipe Script for Neon Database
 * 
 * ⚠️ WARNING: This script will DELETE ALL DATA from your database!
 * 
 * This script will:
 * - Drop all tables (customers, products, orders, inventory, wishlist, cart)
 * - Drop all triggers
 * - Drop all functions
 * - Reset the database to empty state
 * 
 * Usage:
 *   node wipe-database.js
 * 
 * Requires SPR_NEON_DATABSE_URL, DATABASE_URL, or SPR_POSTGRES_URL environment variable
 * Loads from .env.local if available
 */

import pg from 'pg';
import readline from 'readline';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const { Client } = pg;

const TABLES_TO_DROP = [
  'cart',
  'wishlist',
  'order_items',
  'orders',
  'inventory',
  'products',
  'customers'
];

const TRIGGERS_TO_DROP = [
  { table: 'cart', trigger: 'update_cart_updated_at' },
  { table: 'orders', trigger: 'update_orders_updated_at' },
  { table: 'products', trigger: 'update_products_updated_at' },
  { table: 'customers', trigger: 'update_customers_updated_at' },
  { table: 'inventory', trigger: 'update_stock_from_inventory' }
];

const FUNCTIONS_TO_DROP = [
  'update_updated_at_column',
  'update_stock_count_from_inventory'
];

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function wipeDatabase() {
  const databaseUrl = process.env.SPR_NEON_DATABSE_URL || 
                      process.env.DATABASE_URL ||
                      process.env.SPR_POSTGRES_URL;

  if (!databaseUrl) {
    console.error('❌ Error: SPR_NEON_DATABSE_URL, DATABASE_URL, or SPR_POSTGRES_URL not set');
    console.error('   Set one of these environment variables and try again.');
    process.exit(1);
  }

  // Safety confirmation
  console.log('⚠️  WARNING: This will DELETE ALL DATA from your database!');
  console.log('   All tables, data, triggers, and functions will be removed.\n');
  
  const confirmation1 = await askQuestion('Type "WIPE" to confirm: ');
  if (confirmation1 !== 'WIPE') {
    console.log('❌ Confirmation failed. Database wipe cancelled.');
    process.exit(0);
  }

  const confirmation2 = await askQuestion('Are you absolutely sure? Type "YES" to proceed: ');
  if (confirmation2 !== 'YES') {
    console.log('❌ Second confirmation failed. Database wipe cancelled.');
    process.exit(0);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n🔌 Connecting to Neon database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Start transaction for safety
    await client.query('BEGIN');

    console.log('🗑️  Dropping triggers...');
    for (const { table, trigger } of TRIGGERS_TO_DROP) {
      try {
        await client.query(`DROP TRIGGER IF EXISTS ${trigger} ON ${table} CASCADE;`);
        console.log(`   ✅ Dropped trigger: ${trigger} on ${table}`);
      } catch (error) {
        console.warn(`   ⚠️  Could not drop trigger ${trigger} on ${table}: ${error.message}`);
      }
    }

    console.log('\n🗑️  Dropping tables...');
    for (const table of TABLES_TO_DROP) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
        console.log(`   ✅ Dropped table: ${table}`);
      } catch (error) {
        console.warn(`   ⚠️  Could not drop table ${table}: ${error.message}`);
      }
    }

    console.log('\n🗑️  Dropping functions...');
    for (const func of FUNCTIONS_TO_DROP) {
      try {
        await client.query(`DROP FUNCTION IF EXISTS ${func}() CASCADE;`);
        console.log(`   ✅ Dropped function: ${func}`);
      } catch (error) {
        console.warn(`   ⚠️  Could not drop function ${func}: ${error.message}`);
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log('\n✅ Database wipe complete!');
    console.log('   All tables, triggers, and functions have been removed.');
    console.log('   Run neon-schema.sql to recreate the schema.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error wiping database:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

wipeDatabase();

