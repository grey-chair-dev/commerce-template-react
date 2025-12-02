#!/usr/bin/env node

/**
 * Test Discogs API Integration
 * 
 * Usage:
 *   npm run test:discogs
 *   or
 *   node scripts/test-discogs.mjs "Abbey Road The Beatles"
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

const DISCOGS_USER_TOKEN = process.env.DISCOGS_USER_TOKEN
const DISCOGS_USER_AGENT = process.env.DISCOGS_USER_AGENT || 'SpiralGroove/1.0'
const API_URL = process.env.VITE_API_URL || 'http://localhost:3000'

if (!DISCOGS_USER_TOKEN) {
  console.error('❌ Error: DISCOGS_USER_TOKEN environment variable is not set')
  console.error('   Set it in .env.local')
  process.exit(1)
}

async function testDiscogs() {
  const searchQuery = process.argv[2] || 'Abbey Road The Beatles'
  
  console.log('\n🧪 Testing Discogs API Integration\n')
  console.log('='.repeat(60))
  console.log(`Search Query: "${searchQuery}"`)
  console.log(`API URL: ${API_URL}`)
  console.log('='.repeat(60))

  try {
    // Test 1: Search
    console.log('\n1️⃣  Testing Search Endpoint...')
    const searchUrl = `${API_URL}/api/discogs/search?productName=${encodeURIComponent(searchQuery)}`
    console.log(`   URL: ${searchUrl}`)
    
    const searchResponse = await fetch(searchUrl)
    const searchData = await searchResponse.json()
    
    if (!searchResponse.ok) {
      throw new Error(searchData.message || searchData.error || 'Search failed')
    }
    
    console.log(`   ✅ Found ${searchData.count} results`)
    
    if (searchData.results && searchData.results.length > 0) {
      const firstResult = searchData.results[0]
      console.log(`   📀 First result: "${firstResult.title}" (ID: ${firstResult.id})`)
      
      // Test 2: Fetch tracklist
      console.log('\n2️⃣  Testing Fetch Endpoint...')
      const fetchUrl = `${API_URL}/api/discogs/fetch`
      console.log(`   URL: ${fetchUrl}`)
      
      const fetchResponse = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Don't provide productId for testing - just fetch tracklist
          productName: searchQuery,
        }),
      })
      
      const fetchData = await fetchResponse.json()
      
      if (!fetchResponse.ok) {
        throw new Error(fetchData.message || fetchData.error || 'Fetch failed')
      }
      
      console.log(`   ✅ Fetched release: "${fetchData.release.title}"`)
      console.log(`   📊 Track count: ${fetchData.trackCount}`)
      
      if (fetchData.tracklist && fetchData.tracklist.length > 0) {
        console.log('\n   🎵 Track Listing:')
        fetchData.tracklist.slice(0, 5).forEach((track, i) => {
          console.log(`      ${i + 1}. ${track.position} - ${track.title}${track.duration ? ` (${track.duration})` : ''}`)
        })
        if (fetchData.tracklist.length > 5) {
          console.log(`      ... and ${fetchData.tracklist.length - 5} more tracks`)
        }
      }
      
      console.log('\n' + '='.repeat(60))
      console.log('✅ All tests passed!')
      console.log('\n💡 Next steps:')
      console.log('   1. Run database migration: migrations/002_add_discogs_fields.sql')
      console.log('   2. Integrate into product detail page')
      console.log('   3. Create batch script to fetch tracklists for all products')
    } else {
      console.log('   ⚠️  No results found')
    }
  } catch (error) {
    console.error('\n❌ Error testing Discogs API:')
    console.error('   ' + error.message)
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
      console.error('\n💡 The API server is not running.')
      console.error('   Start it with: vercel dev')
    } else if (error.message?.includes('Discogs')) {
      console.error('\n💡 Make sure Discogs credentials are set:')
      console.error('   - DISCOGS_USER_TOKEN in .env.local')
      console.error('   - DISCOGS_USER_AGENT in .env.local (optional)')
    }
    
    process.exit(1)
  }
}

testDiscogs()

