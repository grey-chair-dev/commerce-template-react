#!/usr/bin/env node

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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
  // Ignore
}

const sql = neon(process.env.DATABASE_URL)

async function check() {
  try {
    const count = await sql`SELECT COUNT(*) as count FROM "Product_Detail"`
    console.log(`Product_Detail rows: ${count[0].count}`)
    
    if (count[0].count > 0) {
      const sample = await sql`
        SELECT square_item_id, category, format, 
               CASE WHEN thumbnail_url IS NOT NULL THEN 'yes' ELSE 'no' END as has_image
        FROM "Product_Detail" 
        LIMIT 5
      `
      console.log('\nSample products:')
      sample.forEach(p => {
        console.log(`  - ${p.square_item_id}`)
        console.log(`    Category: ${p.category || 'null'}`)
        console.log(`    Format: ${p.format || 'null'}`)
        console.log(`    Has image: ${p.has_image}`)
      })
    }
  } catch (error) {
    console.error('Error:', error.message)
  }
}

check()

