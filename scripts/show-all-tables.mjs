#!/usr/bin/env node

/**
 * Script to show all tables in the database and their row counts
 * 
 * Usage:
 *   npm run db:show-tables
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
  console.error('   Set it in .env.local')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function showAllTables() {
  console.log('\n📊 Database Tables Overview\n')
  console.log('='.repeat(60))

  try {
    // Get all tables
    const tables = await sql`
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found in the database')
      console.log('\n💡 You may need to create the product_cache table:')
      console.log('   Run: migrations/001_create_product_cache.sql')
      return
    }

    console.log(`\nFound ${tables.length} table(s):\n`)

    for (const table of tables) {
      const tableName = table.table_name
      
      // Get row count
      let rowCount
      try {
        const countResult = await sql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`)
        rowCount = countResult[0]?.count || 0
      } catch (error) {
        rowCount = 'Error: ' + error.message
      }

      // Get table size
      let tableSize
      try {
        const sizeResult = await sql`
          SELECT pg_size_pretty(pg_total_relation_size(${tableName})) as size
        `
        tableSize = sizeResult[0]?.size || 'Unknown'
      } catch (error) {
        tableSize = 'Unknown'
      }

      // Get columns
      let columns = []
      try {
        const cols = await sql`
          SELECT 
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
          ORDER BY ordinal_position
        `
        columns = cols
      } catch (error) {
        // Ignore
      }

      console.log(`📋 Table: ${tableName}`)
      console.log(`   Rows: ${rowCount}`)
      console.log(`   Size: ${tableSize}`)
      
      if (columns.length > 0) {
        console.log(`   Columns: ${columns.map(c => c.column_name).join(', ')}`)
      }

      // Special handling for product_cache
      if (tableName === 'product_cache') {
        try {
          const cacheData = await sql`
            SELECT 
              key,
              (value->>'count')::int as product_count,
              updated_at
            FROM product_cache
          `
          
          if (cacheData.length > 0) {
            console.log(`\n   Cache Entries:`)
            cacheData.forEach(entry => {
              console.log(`     - Key: ${entry.key}`)
              console.log(`       Products: ${entry.product_count || 0}`)
              console.log(`       Updated: ${entry.updated_at}`)
            })
          } else {
            console.log(`\n   ⚠️  Cache is empty - no products stored`)
            console.log(`   💡 Run: npm run db:load-square`)
          }
        } catch (error) {
          console.log(`   ⚠️  Could not read cache data: ${error.message}`)
        }
      }

      console.log('')
    }

    console.log('='.repeat(60))
    console.log('\n💡 What tables do you need?')
    console.log('   ✅ product_cache - Stores all products from Square')
    console.log('   ❌ Other tables - May be leftover from other projects')
    console.log('\n💡 To load products:')
    console.log('   npm run db:load-square')
    console.log('')

  } catch (error) {
    console.error('\n❌ Error inspecting database:')
    console.error(error.message)
    process.exit(1)
  }
}

showAllTables()

