#!/usr/bin/env node

/**
 * ETL Script: Sync Normalized Tables to Star Schema
 * 
 * Extracts data from normalized tables (Order, Order_Item, Square_Item, etc.)
 * Transforms and loads into star schema (sales_fact, product_dim, customer_dim)
 * 
 * Usage:
 *   npm run etl:sync
 *   or
 *   node scripts/etl-sync-star-schema.mjs
 */

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load .env.local file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

try {
  const envFile = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !match[1].startsWith('#')) {
      const key = match[1].trim()
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
} catch (error) {
  if (error.code !== 'ENOENT') {
    console.warn(`⚠️  Warning: Could not read .env.local: ${error.message}`)
  }
}

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not set')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function syncStarSchema() {
  console.log('\n🔄 Syncing Star Schema from Normalized Tables\n')
  console.log('='.repeat(60))

  try {
    // Step 1: Sync Product Dimension
    console.log('\n1️⃣  Syncing Product Dimension...')
    
    // Check if Square_Item table exists and has data
    const hasSquareItem = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'Square_Item'
      )
    `
    
    if (hasSquareItem[0].exists) {
      // Sync from Square_Item and Product_Detail
      const productSync = await sql`
        INSERT INTO product_dim (
          product_id, product_name, category, artist, genre, label,
          format, condition_sleeve, condition_media, is_staff_pick,
          base_price, created_date, updated_at
        )
        SELECT 
          si.square_item_id,
          si.name,
          NULL as category, -- Can be populated from product_cache or other source
          NULL as artist, -- Can be extracted from name or Vinyl_Artist
          NULL as genre, -- Can be extracted from Vinyl_Genre
          NULL as label, -- Can be populated from Product_Detail or Discogs
          pd.format,
          pd.condition_sleeve,
          pd.condition_media,
          COALESCE(pd.is_staff_pick, false),
          si.base_price,
          DATE(si.created_at),
          NOW()
        FROM "Square_Item" si
        LEFT JOIN "Product_Detail" pd ON si.square_item_id = pd.square_item_id
        ON CONFLICT (product_id) 
        DO UPDATE SET
          product_name = EXCLUDED.product_name,
          format = EXCLUDED.format,
          condition_sleeve = EXCLUDED.condition_sleeve,
          condition_media = EXCLUDED.condition_media,
          is_staff_pick = EXCLUDED.is_staff_pick,
          base_price = EXCLUDED.base_price,
          updated_at = NOW()
      `
      console.log(`   ✅ Synced products from Square_Item`)
    } else {
      // Fallback: Sync from product_cache JSONB
      console.log('   ⚠️  Square_Item table not found, syncing from product_cache...')
      
      const cacheData = await sql`
        SELECT value FROM product_cache WHERE key = 'square:products:spiralgroove'
      `
      
      if (cacheData.length > 0 && cacheData[0].value?.products) {
        const products = cacheData[0].value.products
        
        for (const product of products) {
          await sql`
            INSERT INTO product_dim (
              product_id, product_name, category,
              base_price, created_date, updated_at
            )
            VALUES (
              ${product.id},
              ${product.name},
              ${product.category || null},
              ${product.price || null},
              CURRENT_DATE,
              NOW()
            )
            ON CONFLICT (product_id)
            DO UPDATE SET
              product_name = EXCLUDED.product_name,
              category = EXCLUDED.category,
              base_price = EXCLUDED.base_price,
              updated_at = NOW()
          `
        }
        console.log(`   ✅ Synced ${products.length} products from product_cache`)
      } else {
        console.log('   ⚠️  No products found in product_cache')
      }
    }

    // Step 2: Sync Customer Dimension
    console.log('\n2️⃣  Syncing Customer Dimension...')
    
    const customerSync = await sql`
      INSERT INTO customer_dim (
        customer_id, customer_name, email, customer_segment,
        signup_date, updated_at
      )
      SELECT 
        customer_id,
        name,
        email,
        CASE 
          WHEN created_at < NOW() - INTERVAL '1 year' THEN 'VIP'
          WHEN created_at < NOW() - INTERVAL '6 months' THEN 'Regular'
          ELSE 'New'
        END as customer_segment,
        DATE(created_at),
        NOW()
      FROM "Customer"
      ON CONFLICT (customer_id)
      DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        email = EXCLUDED.email,
        customer_segment = EXCLUDED.customer_segment,
        updated_at = NOW()
    `
    console.log(`   ✅ Synced customers`)

    // Step 3: Sync Sales Fact
    console.log('\n3️⃣  Syncing Sales Fact...')
    
    const salesSync = await sql`
      INSERT INTO sales_fact (
        product_id, customer_id, order_date,
        quantity, unit_price, total_amount, discount_amount,
        order_id, order_number
      )
      SELECT 
        oi.square_item_id,
        o.customer_id,
        DATE(o.created_at),
        oi.quantity,
        oi.price_at_purchase,
        oi.quantity * oi.price_at_purchase as total_amount,
        0 as discount_amount, -- Can be calculated if discount data exists
        o.order_id::text,
        o.order_number
      FROM "Order_Item" oi
      JOIN "Order" o ON oi.order_id = o.order_id
      WHERE NOT EXISTS (
        SELECT 1 FROM sales_fact sf
        WHERE sf.order_id = o.order_id::text
        AND sf.product_id = oi.square_item_id
      )
      ON CONFLICT DO NOTHING
    `
    console.log(`   ✅ Synced sales transactions`)

    // Summary
    const productCount = await sql`SELECT COUNT(*) as count FROM product_dim`
    const customerCount = await sql`SELECT COUNT(*) as count FROM customer_dim`
    const salesCount = await sql`SELECT COUNT(*) as count FROM sales_fact`

    console.log('\n' + '='.repeat(60))
    console.log('\n📊 Star Schema Summary:')
    console.log(`   Products: ${productCount[0].count}`)
    console.log(`   Customers: ${customerCount[0].count}`)
    console.log(`   Sales: ${salesCount[0].count}`)
    console.log('\n✅ Star schema sync complete!\n')

  } catch (error) {
    console.error('\n❌ Error syncing star schema:')
    console.error(error.message)
    
    if (error.message?.includes('does not exist')) {
      console.error('\n💡 The star schema tables might not exist.')
      console.error('   Run the migration: migrations/003_create_star_schema.sql')
    }
    
    process.exit(1)
  }
}

syncStarSchema()

