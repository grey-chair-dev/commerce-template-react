#!/usr/bin/env node

/**
 * Generate bcrypt hash for client password
 * 
 * Usage: node scripts/generate-client-password-hash.mjs <password>
 * 
 * This will output a bcrypt hash that you can use for VITE_CLIENT_PASSWORD_HASH
 */

import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const password = process.argv[2]

if (!password) {
  console.error('Usage: node scripts/generate-client-password-hash.mjs <password>')
  console.error('\nExample:')
  console.error('  node scripts/generate-client-password-hash.mjs "my-secure-password"')
  process.exit(1)
}

async function generateHash() {
  try {
    const saltRounds = 10
    const hash = await bcrypt.hash(password, saltRounds)
    
    console.log('\n✅ Password hash generated successfully!\n')
    console.log('Add this to your .env.local file:')
    console.log(`VITE_CLIENT_PASSWORD_HASH=${hash}\n`)
    console.log('⚠️  Keep this hash secure and never commit it to version control!\n')
  } catch (error) {
    console.error('Error generating hash:', error)
    process.exit(1)
  }
}

generateHash()

