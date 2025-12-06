#!/usr/bin/env node
/**
 * Test Database Connection
 * 
 * Tests if we can connect to the database and access the product_cache table
 */

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local
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
  console.error('Error loading .env.local:', error.message)
}

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found')
  process.exit(1)
}

console.log('🔍 Testing database connection...\n')
console.log('📋 Connection String (first 50 chars):', DATABASE_URL.substring(0, 50) + '...\n')

// Extract user from connection string
const userMatch = DATABASE_URL.match(/postgresql:\/\/([^:]+):/)
const dbUser = userMatch ? userMatch[1] : 'unknown'
console.log('👤 Database User:', dbUser)

// Extract database name
const dbMatch = DATABASE_URL.match(/\/([^?]+)\?/)
const dbName = dbMatch ? dbMatch[1] : 'unknown'
console.log('🗄️  Database Name:', dbName)
console.log('')

async function testConnection() {
  try {
    const sql = neon(DATABASE_URL)
    
    // Test 1: Basic connection
    console.log('1️⃣  Testing basic connection...')
    const result1 = await sql`SELECT current_user, current_database()`
    console.log('   ✅ Connected!')
    console.log('   User:', result1[0].current_user)
    console.log('   Database:', result1[0].current_database)
    console.log('')
    
    // Test 2: Check if table exists
    console.log('2️⃣  Checking if product_cache table exists...')
    const result2 = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'product_cache'
      )
    `
    const tableExists = result2[0].exists
    console.log('   Table exists:', tableExists ? '✅ Yes' : '❌ No')
    console.log('')
    
    if (tableExists) {
      // Test 3: Check table structure
      console.log('3️⃣  Checking table structure...')
      const result3 = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'product_cache'
        ORDER BY ordinal_position
      `
      console.log('   Columns:')
      result3.forEach(col => {
        console.log(`      - ${col.column_name} (${col.data_type})`)
      })
      console.log('')
      
      // Test 4: Check permissions (try to read)
      console.log('4️⃣  Testing read permissions...')
      const result4 = await sql`SELECT COUNT(*) as count FROM product_cache`
      console.log('   ✅ Can read from table')
      console.log('   Current rows:', result4[0].count)
      console.log('')
      
      // Test 5: Check write permissions (try to insert/update)
      console.log('5️⃣  Testing write permissions...')
      const testKey = 'test:connection:check'
      await sql`
        INSERT INTO product_cache (key, value, updated_at)
        VALUES (${testKey}, '{"test": true}'::jsonb, NOW())
        ON CONFLICT (key) 
        DO UPDATE SET updated_at = NOW()
      `
      console.log('   ✅ Can write to table')
      
      // Clean up test row
      await sql`DELETE FROM product_cache WHERE key = ${testKey}`
      console.log('   ✅ Can delete from table')
      console.log('')
      
      console.log('✅ All tests passed! Database connection is working.')
    } else {
      console.log('❌ Table does not exist. Please create it first.')
      console.log('   Run this SQL in Neon SQL Editor:')
      console.log('   CREATE TABLE IF NOT EXISTS product_cache (')
      console.log('     key TEXT PRIMARY KEY,')
      console.log('     value JSONB NOT NULL,')
      console.log('     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()')
      console.log('   );')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.message.includes('does not exist')) {
      console.error('\n💡 The table might not exist, or you might be connected to the wrong database.')
    } else if (error.message.includes('permission denied')) {
      console.error('\n💡 Permission denied. The database user might not have access to the table.')
      console.error('   Try using a different DATABASE_URL with admin permissions.')
    } else if (error.message.includes('password')) {
      console.error('\n💡 Authentication failed. Check your DATABASE_URL credentials.')
    }
    process.exit(1)
  }
}

testConnection()

