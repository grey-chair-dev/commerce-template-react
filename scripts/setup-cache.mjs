#!/usr/bin/env node
/**
 * Setup Product Cache
 * 
 * This script:
 * 1. Creates the product_cache table in Neon
 * 2. Warms the cache by fetching products from Square
 * 
 * Usage:
 *   node scripts/setup-cache.mjs
 */

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Try to load .env.local manually
try {
  const envFile = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !match[1].startsWith('#')) {
      const key = match[1].trim()
      let value = match[2].trim()
      // Remove quotes if present
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
  // .env.local might not exist, that's okay
}

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables')
  console.error('   Please set DATABASE_URL in .env.local')
  process.exit(1)
}

async function setupCache() {
  console.log('🚀 Setting up product cache...\n')

  try {
    const sql = neon(DATABASE_URL)

    // Step 1: Create table
    console.log('📦 Creating product_cache table...')
    await sql`
      CREATE TABLE IF NOT EXISTS product_cache (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_product_cache_updated_at 
      ON product_cache(updated_at)
    `
    console.log('✅ Table created successfully\n')

    // Step 2: Check if cache exists
    console.log('🔍 Checking existing cache...')
    const existing = await sql`
      SELECT key, updated_at 
      FROM product_cache 
      WHERE key = 'square:products:spiralgroove'
    `

    if (existing.length > 0) {
      console.log(`✅ Cache already exists (updated: ${existing[0].updated_at})`)
      console.log('\n💡 To refresh the cache, call:')
      console.log('   curl http://localhost:3000/api/warm-cache')
      console.log('   or visit: http://localhost:3000/api/warm-cache\n')
    } else {
      console.log('⚠️  Cache is empty')
      console.log('\n💡 To warm the cache, call:')
      console.log('   curl http://localhost:3000/api/warm-cache')
      console.log('   or visit: http://localhost:3000/api/warm-cache\n')
      console.log('   Make sure your Vercel dev server is running!')
    }

    console.log('✅ Setup complete!')
  } catch (error) {
    console.error('❌ Error setting up cache:', error.message)
    if (error.message.includes('does not exist')) {
      console.error('\n💡 Make sure you\'re connected to the correct database')
    }
    process.exit(1)
  }
}

setupCache()

