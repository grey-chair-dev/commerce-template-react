#!/usr/bin/env node

/**
 * Script to inspect the product_cache database
 * 
 * Usage:
 *   node scripts/inspect-db.mjs
 * 
 * Requires DATABASE_URL environment variable (from .env.local)
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
  // .env.local might not exist, that's okay - use environment variables
  if (error.code !== 'ENOENT') {
    console.warn(`⚠️  Warning: Could not read .env.local: ${error.message}`)
  }
}

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not set')
  console.error('   Set it in .env.local or export it before running this script')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function inspectDatabase() {
  console.log('\n🔍 Inspecting Database...\n')
  console.log('=' .repeat(60))

  try {
    // 1. Check if table exists
    console.log('\n1️⃣  Checking if product_cache table exists...')
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'product_cache'
      ) as exists
    `
    
    if (!tableCheck[0].exists) {
      console.log('   ❌ product_cache table does NOT exist')
      console.log('   💡 Run the migration: migrations/001_create_product_cache.sql')
      return
    }
    console.log('   ✅ product_cache table exists')

    // 2. Check if cache entry exists
    console.log('\n2️⃣  Checking if cache entry exists...')
    const cacheCheck = await sql`
      SELECT EXISTS (
        SELECT 1 
        FROM product_cache 
        WHERE key = 'square:products:spiralgroove'
      ) as exists
    `
    
    if (!cacheCheck[0].exists) {
      console.log('   ❌ Cache entry does NOT exist')
      console.log('   💡 Run: curl http://localhost:3000/api/warm-cache')
      return
    }
    console.log('   ✅ Cache entry exists')

    // 3. Get product count and metadata
    console.log('\n3️⃣  Product count and metadata...')
    const metadata = await sql`
      SELECT 
        key,
        (value->>'count')::int as product_count,
        value->>'timestamp' as cache_timestamp,
        updated_at as last_updated,
        NOW() - updated_at as age
      FROM product_cache
      WHERE key = 'square:products:spiralgroove'
    `
    
    if (metadata.length > 0) {
      const m = metadata[0]
      console.log(`   📦 Products: ${m.product_count}`)
      console.log(`   🕐 Last updated: ${m.last_updated}`)
      console.log(`   ⏱️  Age: ${m.age}`)
      console.log(`   📅 Cache timestamp: ${m.cache_timestamp}`)
    }

    // 4. Get sample products
    console.log('\n4️⃣  Sample products (first 3)...')
    const samples = await sql`
      SELECT 
        jsonb_array_elements(value->'products')->>'id' as id,
        jsonb_array_elements(value->'products')->>'name' as name,
        jsonb_array_elements(value->'products')->>'price' as price,
        jsonb_array_elements(value->'products')->>'category' as category,
        jsonb_array_elements(value->'products')->>'stockCount' as stock
      FROM product_cache
      WHERE key = 'square:products:spiralgroove'
      LIMIT 3
    `
    
    if (samples.length > 0) {
      samples.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name}`)
        console.log(`      ID: ${p.id}`)
        console.log(`      Price: $${p.price}`)
        console.log(`      Category: ${p.category}`)
        console.log(`      Stock: ${p.stock}`)
      })
    } else {
      console.log('   ⚠️  No products found')
    }

    // 5. Get categories
    console.log('\n5️⃣  Categories...')
    const categories = await sql`
      SELECT DISTINCT
        jsonb_array_elements(value->'products')->>'category' as category,
        COUNT(*) OVER (PARTITION BY jsonb_array_elements(value->'products')->>'category') as count
      FROM product_cache
      WHERE key = 'square:products:spiralgroove'
      ORDER BY count DESC
    `
    
    if (categories.length > 0) {
      console.log(`   Found ${categories.length} categories:`)
      categories.forEach(cat => {
        console.log(`   - ${cat.category}: ${cat.count} products`)
      })
    } else {
      console.log('   ⚠️  No categories found')
    }

    // 6. Database size
    console.log('\n6️⃣  Database size...')
    const size = await sql`
      SELECT 
        pg_size_pretty(pg_total_relation_size('product_cache')) as total_size,
        pg_size_pretty(pg_relation_size('product_cache')) as table_size
    `
    
    if (size.length > 0) {
      console.log(`   📊 Total size: ${size[0].total_size}`)
      console.log(`   📊 Table size: ${size[0].table_size}`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Inspection complete!\n')

  } catch (error) {
    console.error('\n❌ Error inspecting database:')
    console.error(error.message)
    if (error.message.includes('does not exist')) {
      console.error('\n💡 The product_cache table might not exist.')
      console.error('   Run the migration: migrations/001_create_product_cache.sql')
    }
    process.exit(1)
  }
}

inspectDatabase()

