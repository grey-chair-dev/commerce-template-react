#!/usr/bin/env node

/**
 * Sync product_cache to Product_Detail table
 * 
 * Extracts extended product information from product_cache (JSONB) 
 * and populates/updates Product_Detail table
 * 
 * Usage:
 *   npm run db:sync-product-details
 *   or
 *   node scripts/sync-product-details.mjs
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

async function syncProductDetails() {
  console.log('\n🔄 Syncing product_cache to Product_Detail table...\n')
  console.log('='.repeat(60))

  try {
    // Check if Product_Detail table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'Product_Detail'
      )
    `

    if (!tableExists[0].exists) {
      console.error('❌ Error: Product_Detail table does not exist')
      console.error('   Run migration: migrations/004_create_normalized_tables.sql')
      process.exit(1)
    }

    // Check if required columns exist
    const thumbnailUrlExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Product_Detail' 
        AND column_name = 'thumbnail_url'
      )
    `

    const categoryExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Product_Detail' 
        AND column_name = 'category'
      )
    `

    if (!thumbnailUrlExists[0].exists || !categoryExists[0].exists) {
      console.error('❌ Error: Required columns do not exist in Product_Detail table')
      console.error('   Missing columns:')
      if (!thumbnailUrlExists[0].exists) console.error('     - thumbnail_url')
      if (!categoryExists[0].exists) console.error('     - category')
      console.error('   Run migration: migrations/005_add_image_url_to_product_detail.sql')
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

    // Sync to Product_Detail
    console.log('\n💾 Syncing to Product_Detail table...')
    let inserted = 0
    let updated = 0
    let errors = 0

    for (const product of products) {
      try {
        // First, ensure the product exists in Square_Item (required for foreign key)
        const squareItemExists = await sql`
          SELECT square_item_id FROM "Square_Item" WHERE square_item_id = ${product.id}
        `

        if (squareItemExists.length === 0) {
          console.warn(`   ⚠️  Skipping ${product.id}: not found in Square_Item table`)
          console.warn(`      Run: npm run db:sync-square-items first`)
          errors++
          continue
        }

        // Check if product detail already exists
        const existing = await sql`
          SELECT square_item_id FROM "Product_Detail" WHERE square_item_id = ${product.id}
        `
        
        const wasExisting = existing.length > 0
        
        // Insert or update Product_Detail
        await sql`
          INSERT INTO "Product_Detail" (
            square_item_id,
            thumbnail_url,
            category,
            format,
            condition_sleeve,
            condition_media,
            full_description,
            is_staff_pick,
            updated_at
          )
          VALUES (
            ${product.id},
            ${product.imageUrl || null},
            ${product.category || null},
            ${product.format || null},
            ${product.conditionSleeve || null},
            ${product.conditionMedia || null},
            ${product.description || null},
            ${product.isStaffPick || false},
            NOW()
          )
          ON CONFLICT (square_item_id)
          DO UPDATE SET
            thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, "Product_Detail".thumbnail_url),
            category = COALESCE(EXCLUDED.category, "Product_Detail".category),
            format = COALESCE(EXCLUDED.format, "Product_Detail".format),
            condition_sleeve = COALESCE(EXCLUDED.condition_sleeve, "Product_Detail".condition_sleeve),
            condition_media = COALESCE(EXCLUDED.condition_media, "Product_Detail".condition_media),
            full_description = COALESCE(EXCLUDED.full_description, "Product_Detail".full_description),
            is_staff_pick = COALESCE(EXCLUDED.is_staff_pick, "Product_Detail".is_staff_pick),
            updated_at = NOW()
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
    const count = await sql`SELECT COUNT(*) as count FROM "Product_Detail"`
    const withImages = await sql`SELECT COUNT(*) as count FROM "Product_Detail" WHERE thumbnail_url IS NOT NULL`
    console.log(`   Total in Product_Detail: ${count[0].count}`)
    console.log(`   With thumbnail_url: ${withImages[0].count}`)
    console.log('')

  } catch (error) {
    console.error('\n❌ Error syncing product details:')
    console.error(error.message)
    
    if (error.message?.includes('does not exist')) {
      console.error('\n💡 The Product_Detail table or thumbnail_url column might not exist.')
      console.error('   Run migrations:')
      console.error('   1. migrations/004_create_normalized_tables.sql')
      console.error('   2. migrations/005_add_image_url_to_product_detail.sql')
    }
    
    process.exit(1)
  }
}

syncProductDetails()

