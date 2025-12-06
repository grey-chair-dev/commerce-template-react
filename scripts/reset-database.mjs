#!/usr/bin/env node

/**
 * Reset Database - Clear all tables and start fresh
 * 
 * WARNING: This will delete ALL data in the database!
 * 
 * Usage:
 *   npm run db:reset
 *   or
 *   node scripts/reset-database.mjs
 * 
 * This will:
 * 1. Drop all existing tables
 * 2. You can then run migrations to recreate only what you need
 */

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import readline from 'readline'

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

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close()
      resolve(answer)
    })
  })
}

async function resetDatabase() {
  console.log('\n⚠️  WARNING: This will DELETE ALL DATA in your database!\n')
  console.log('='.repeat(60))
  
  // Get confirmation
  const answer = await askQuestion('Are you sure you want to continue? (type "yes" to confirm): ')
  
  if (answer.toLowerCase() !== 'yes') {
    console.log('\n❌ Cancelled. Database not modified.\n')
    process.exit(0)
  }

  console.log('\n🗑️  Resetting database...\n')
  console.log('='.repeat(60))

  try {
    // Get all tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `

    if (tables.length === 0) {
      console.log('✅ No tables found. Database is already empty.\n')
      return
    }

    console.log(`Found ${tables.length} table(s) to drop:\n`)

    // Drop all tables (CASCADE to handle foreign keys)
    for (const table of tables) {
      const tableName = table.table_name
      try {
        console.log(`   Dropping: ${tableName}...`)
        await sql.unsafe(`DROP TABLE IF EXISTS "${tableName}" CASCADE`)
        console.log(`   ✅ Dropped: ${tableName}`)
      } catch (error) {
        console.error(`   ❌ Error dropping ${tableName}: ${error.message}`)
      }
    }

    // Also drop any sequences that might be left
    try {
      const sequences = await sql`
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
      `
      
      if (sequences.length > 0) {
        console.log(`\n   Dropping ${sequences.length} sequence(s)...`)
        for (const seq of sequences) {
          try {
            await sql.unsafe(`DROP SEQUENCE IF EXISTS "${seq.sequence_name}" CASCADE`)
          } catch (error) {
            // Ignore errors for sequences
          }
        }
      }
    } catch (error) {
      // Ignore sequence errors
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Database reset complete!\n')
    console.log('📋 Next steps:')
    console.log('   1. Run migration: migrations/001_create_product_cache.sql')
    console.log('   2. Run migration: migrations/002_add_discogs_fields.sql (if using Discogs)')
    console.log('   3. Load products: npm run db:load-square')
    console.log('')

  } catch (error) {
    console.error('\n❌ Error resetting database:')
    console.error(error.message)
    process.exit(1)
  }
}

resetDatabase()

