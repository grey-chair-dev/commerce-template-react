#!/usr/bin/env node
/**
 * Schema Verification Script for Neon Database
 * 
 * This script verifies that all required tables, indexes, and triggers
 * are properly set up in your Neon database.
 * 
 * Usage:
 *   node verify-schema.js
 * 
 * Requires SPR_NEON_DATABSE_URL, DATABASE_URL, or SPR_POSTGRES_URL environment variable
 * Loads from .env.local if available
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const { Client } = pg;

const REQUIRED_TABLES = [
  'customers',
  'products',
  'inventory',
  'orders',
  'order_items',
  'wishlist',
  'cart'
];

const REQUIRED_INDEXES = [
  { table: 'customers', index: 'idx_customers_email' },
  { table: 'customers', index: 'idx_customers_auth_user_id' },
  { table: 'products', index: 'idx_products_category' },
  { table: 'products', index: 'idx_products_stock_count' },
  { table: 'inventory', index: 'idx_inventory_product_id' },
  { table: 'orders', index: 'idx_orders_customer_id' },
  { table: 'orders', index: 'idx_orders_user_id' },
  { table: 'orders', index: 'idx_orders_status' },
  { table: 'order_items', index: 'idx_order_items_order_id' },
  { table: 'wishlist', index: 'idx_wishlist_user_id' },
  { table: 'cart', index: 'idx_cart_user_id' }
];

const REQUIRED_TRIGGERS = [
  { table: 'customers', trigger: 'update_customers_updated_at' },
  { table: 'products', trigger: 'update_products_updated_at' },
  { table: 'orders', trigger: 'update_orders_updated_at' },
  { table: 'cart', trigger: 'update_cart_updated_at' },
  { table: 'inventory', trigger: 'update_stock_from_inventory' }
];

async function verifySchema() {
  const databaseUrl = process.env.SPR_NEON_DATABSE_URL || 
                      process.env.DATABASE_URL ||
                      process.env.SPR_POSTGRES_URL;

  if (!databaseUrl) {
    console.error('❌ Error: SPR_NEON_DATABSE_URL, DATABASE_URL, or SPR_POSTGRES_URL not set');
    console.error('   Set one of these environment variables and try again.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to Neon database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Verify tables
    console.log('📋 Verifying tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const existingTables = tablesResult.rows.map(row => row.table_name);
    const missingTables = REQUIRED_TABLES.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.error(`❌ Missing tables: ${missingTables.join(', ')}`);
      console.error('   Run neon-schema.sql to create missing tables.\n');
    } else {
      console.log(`✅ All ${REQUIRED_TABLES.length} required tables exist\n`);
    }

    // Verify indexes
    console.log('🔍 Verifying indexes...');
    const indexesResult = await client.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY tablename, indexname
    `);
    
    const existingIndexes = indexesResult.rows.map(row => ({
      table: row.tablename,
      index: row.indexname
    }));
    
    const missingIndexes = REQUIRED_INDEXES.filter(req => 
      !existingIndexes.some(ex => 
        ex.table === req.table && ex.index === req.index
      )
    );
    
    if (missingIndexes.length > 0) {
      console.warn(`⚠️  Missing indexes:`);
      missingIndexes.forEach(mi => {
        console.warn(`   - ${mi.table}.${mi.index}`);
      });
      console.warn('   Run neon-schema.sql to create missing indexes.\n');
    } else {
      console.log(`✅ All ${REQUIRED_INDEXES.length} required indexes exist\n`);
    }

    // Verify triggers
    console.log('⚡ Verifying triggers...');
    const triggersResult = await client.query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `);
    
    const existingTriggers = triggersResult.rows.map(row => ({
      table: row.event_object_table,
      trigger: row.trigger_name
    }));
    
    const missingTriggers = REQUIRED_TRIGGERS.filter(req =>
      !existingTriggers.some(ex =>
        ex.table === req.table && ex.trigger === req.trigger
      )
    );
    
    if (missingTriggers.length > 0) {
      console.warn(`⚠️  Missing triggers:`);
      missingTriggers.forEach(mt => {
        console.warn(`   - ${mt.table}.${mt.trigger}`);
      });
      console.warn('   Run neon-schema.sql to create missing triggers.\n');
    } else {
      console.log(`✅ All ${REQUIRED_TRIGGERS.length} required triggers exist\n`);
    }

    // Check sample data
    console.log('📊 Checking sample data...');
    const productsResult = await client.query('SELECT COUNT(*) as count FROM products');
    const productCount = parseInt(productsResult.rows[0].count);
    
    if (productCount === 0) {
      console.warn('⚠️  No products found in database');
      console.warn('   Run neon-schema.sql to insert sample data.\n');
    } else {
      console.log(`✅ Found ${productCount} products in database\n`);
    }

    // Check customers
    const customersResult = await client.query('SELECT COUNT(*) as count FROM customers');
    const customerCount = parseInt(customersResult.rows[0].count);

    // Summary
    console.log('📈 Summary:');
    console.log(`   Tables: ${REQUIRED_TABLES.length - missingTables.length}/${REQUIRED_TABLES.length}`);
    console.log(`   Indexes: ${REQUIRED_INDEXES.length - missingIndexes.length}/${REQUIRED_INDEXES.length}`);
    console.log(`   Triggers: ${REQUIRED_TRIGGERS.length - missingTriggers.length}/${REQUIRED_TRIGGERS.length}`);
    console.log(`   Products: ${productCount}`);
    console.log(`   Customers: ${customerCount}`);
    
    if (missingTables.length === 0 && missingIndexes.length === 0 && missingTriggers.length === 0) {
      console.log('\n✅ Schema verification complete! All required components are in place.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Schema verification complete with warnings. See above for details.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error verifying schema:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifySchema();

