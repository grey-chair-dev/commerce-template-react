#!/usr/bin/env node

/**
 * Script to load Square items into the database
 * 
 * Usage:
 *   npm run db:load-square
 *   or
 *   node scripts/load-square-to-db.mjs
 * 
 * This script:
 * 1. Fetches all products from Square
 * 2. Transforms them to app format
 * 3. Stores them in the Neon database
 * 
 * Requires:
 * - DATABASE_URL in .env.local
 * - SQUARE_ACCESS_TOKEN in .env.local
 * - SQUARE_LOCATION_ID in .env.local
 * - SQUARE_ENVIRONMENT in .env.local (optional, defaults to 'sandbox')
 */

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

// Check required environment variables
const DATABASE_URL = process.env.DATABASE_URL
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID
const SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'sandbox'

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not set')
  console.error('   Set it in .env.local')
  process.exit(1)
}

if (!SQUARE_ACCESS_TOKEN) {
  console.error('❌ Error: SQUARE_ACCESS_TOKEN environment variable is not set')
  console.error('   Set it in .env.local')
  process.exit(1)
}

if (!SQUARE_LOCATION_ID) {
  console.error('❌ Error: SQUARE_LOCATION_ID environment variable is not set')
  console.error('   Set it in .env.local')
  process.exit(1)
}

// Import services (using .js extension as TypeScript compiles to .js)
// Note: We need to use dynamic import or compile first
// For now, let's use a workaround by importing from the built files or using tsx/ts-node
// Actually, since we're in .mjs, we need to import the compiled JS or use a different approach

// Let's use dynamic import with the source files (if using tsx/ts-node) or check if there's a build
// For simplicity, let's create a version that uses the API endpoint approach or imports directly

async function loadSquareToDatabase() {
  console.log('\n🔄 Loading Square items into database...\n')
  console.log('='.repeat(60))

  try {
    // Use the warm-cache API endpoint
    // This requires vercel dev to be running, or use the deployed URL
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3000'
    
    console.log('📡 Fetching products from Square...')
    console.log(`   Environment: ${SQUARE_ENVIRONMENT}`)
    console.log(`   Location ID: ${SQUARE_LOCATION_ID}`)
    console.log(`   API URL: ${apiUrl}`)
    console.log('')
    
    const response = await fetch(`${apiUrl}/api/warm-cache`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`)
    }
    
    if (data.success) {
      console.log(`✅ Successfully loaded ${data.productCount} products into database`)
      console.log(`   Timestamp: ${data.timestamp}`)
      console.log('\n' + '='.repeat(60))
      console.log('\n💡 Tip: Run "npm run db:inspect" to verify the data was loaded')
    } else {
      throw new Error(data.message || 'Failed to load products')
    }
  } catch (error) {
    console.error('\n❌ Error loading Square items:')
    console.error('   ' + error.message)
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
      console.error('\n💡 The API server is not running.')
      console.error('   Start it with: vercel dev')
      console.error('   Or use the deployed URL by setting VITE_API_URL in .env.local')
    } else if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
      console.error('\n💡 The product_cache table might not exist.')
      console.error('   Run the migration: migrations/001_create_product_cache.sql')
      console.error('   Or visit: https://console.neon.tech and run the SQL in the SQL Editor')
    } else if (error.message?.includes('DATABASE_URL')) {
      console.error('\n💡 Make sure DATABASE_URL is set in .env.local')
      console.error('   Also set it in Vercel: vercel env add DATABASE_URL')
    } else if (error.message?.includes('SQUARE') || error.message?.includes('Square')) {
      console.error('\n💡 Make sure Square credentials are set:')
      console.error('   - SQUARE_ACCESS_TOKEN in .env.local and Vercel')
      console.error('   - SQUARE_LOCATION_ID in .env.local and Vercel')
      console.error('   - SQUARE_ENVIRONMENT in .env.local and Vercel (optional, defaults to sandbox)')
      console.error('\n   Set in Vercel with: vercel env add SQUARE_ACCESS_TOKEN')
    }
    
    process.exit(1)
  }
}

loadSquareToDatabase()

