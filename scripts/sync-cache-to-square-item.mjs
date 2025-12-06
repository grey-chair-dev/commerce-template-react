#!/usr/bin/env node

/**
 * Sync product_cache to Square_Item table
 * 
 * Extracts products from product_cache (JSONB) and populates Square_Item table
 * 
 * Usage:
 *   npm run db:sync-square-items
 *   or
 *   node scripts/sync-cache-to-square-item.mjs
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

async function syncCacheToSquareItem() {
  console.log('\n🔄 Syncing product_cache to Square_Item table...\n')
  console.log('='.repeat(60))

  try {
    // Check if Square_Item table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'Square_Item'
      )
    `

    if (!tableExists[0].exists) {
      console.error('❌ Error: Square_Item table does not exist')
      console.error('   Run migration: migrations/004_create_normalized_tables.sql')
      process.exit(1)
    }

    // Get products from product_cache
    console.log('📥 Reading products from product_cache...')
    const cacheData = await sql`
      SELECT value FROM product_cache WHERE key = 'square:products:spiralgroove'
    `

    if (cacheData.length === 0 || !cacheData[0].value?.products) {
      console.error('❌ Error: No products found in product_cache')
      console.error('   Run: npm run db:load-square')
      process.exit(1)
    }

    const products = cacheData[0].value.products
    console.log(`   Found ${products.length} products in cache`)

    // Sync to Square_Item
    console.log('\n💾 Syncing to Square_Item table...')
    let inserted = 0
    let updated = 0
    let errors = 0

    for (const product of products) {
      try {
        // Check if product exists
        const existing = await sql`
          SELECT square_item_id FROM "Square_Item" WHERE square_item_id = ${product.id}
        `
        
        const wasExisting = existing.length > 0

        // Insert or update Square_Item (without stock_level)
        await sql`
          INSERT INTO "Square_Item" (
            square_item_id,
            name,
            base_price,
            updated_at
          )
          VALUES (
            ${product.id},
            ${product.name || 'Unnamed'},
            ${product.price || 0},
            NOW()
          )
          ON CONFLICT (square_item_id)
          DO UPDATE SET
            name = EXCLUDED.name,
            base_price = EXCLUDED.base_price,
            updated_at = NOW()
        `

        // Sync inventory to Inventory dimension table
        await sql`
          INSERT INTO "Inventory" (
            square_item_id,
            stock_level,
            recorded_at,
            source
          )
          VALUES (
            ${product.id},
            ${product.stockCount || 0},
            NOW(),
            'sync'
          )
        `
        
        if (wasExisting) {
          updated++
        } else {
          inserted++
        }
      } catch (error) {
        console.error(`   ❌ Error syncing product ${product.id}: ${error.message}`)
        errors++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Sync complete!')
    console.log(`   Inserted: ${inserted}`)
    console.log(`   Updated: ${updated}`)
    if (errors > 0) {
      console.log(`   Errors: ${errors}`)
    }

    // Verify
    const count = await sql`SELECT COUNT(*) as count FROM "Square_Item"`
    console.log(`   Total in Square_Item: ${count[0].count}`)
    console.log('')

  } catch (error) {
    console.error('\n❌ Error syncing products:')
    console.error(error.message)
    
    if (error.message?.includes('does not exist')) {
      console.error('\n💡 The Square_Item table might not exist.')
      console.error('   Run migration: migrations/004_create_normalized_tables.sql')
    }
    
    process.exit(1)
  }
}

syncCacheToSquareItem()

