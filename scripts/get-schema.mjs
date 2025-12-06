#!/usr/bin/env node

/**
 * Get complete database schema
 * 
 * Usage:
 *   npm run db:schema
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

async function getSchema() {
  console.log('\n📊 Database Schema\n')
  console.log('='.repeat(80))

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
    
    for (const table of tables) {
      const tableName = table.table_name
      
      console.log(`\n📋 Table: ${tableName}`)
      console.log('-'.repeat(80))
      
      // Get columns
      const columns = await sql`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
        ORDER BY ordinal_position
      `
      
      if (columns.length > 0) {
        console.log('\nColumns:')
        columns.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'
          const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : ''
          const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : ''
          console.log(`  • ${col.column_name}: ${col.data_type}${maxLength} ${nullable}${defaultVal}`)
        })
      }
      
      // Get primary keys
      const primaryKeys = await sql`
        SELECT column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = ${tableName}
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
      `
      
      if (primaryKeys.length > 0) {
        console.log(`\nPrimary Key: ${primaryKeys.map(pk => pk.column_name).join(', ')}`)
      }
      
      // Get foreign keys
      const foreignKeys = await sql`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = ${tableName}
      `
      
      if (foreignKeys.length > 0) {
        console.log('\nForeign Keys:')
        foreignKeys.forEach(fk => {
          console.log(`  • ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`)
        })
      }
      
      // Get indexes
      const indexes = await sql`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = ${tableName}
          AND indexname NOT LIKE '%_pkey'
        ORDER BY indexname
      `
      
      if (indexes.length > 0) {
        console.log('\nIndexes:')
        indexes.forEach(idx => {
          console.log(`  • ${idx.indexname}`)
        })
      }
      
      // Get row count
      try {
        const countResult = await sql.unsafe(`SELECT COUNT(*) as count FROM "${tableName}"`)
        const rowCount = countResult[0]?.count || 0
        console.log(`\nRow Count: ${rowCount}`)
      } catch (error) {
        // Ignore
      }
    }
    
    console.log('\n' + '='.repeat(80))
    console.log('\n✅ Schema export complete!\n')
    
  } catch (error) {
    console.error('\n❌ Error getting schema:')
    console.error(error.message)
    process.exit(1)
  }
}

getSchema()

