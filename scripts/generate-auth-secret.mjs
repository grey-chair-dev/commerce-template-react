#!/usr/bin/env node

/**
 * Generate a random 32-byte secret for JWT signing
 * 
 * Usage: node scripts/generate-auth-secret.mjs
 * 
 * This will output a random hex string that you can use for VITE_AUTH_SECRET
 */

import crypto from 'crypto'

const secret = crypto.randomBytes(32).toString('hex')

console.log('\n✅ Auth secret generated successfully!\n')
console.log('Add this to your .env.local file:')
console.log(`VITE_AUTH_SECRET=${secret}\n`)
console.log('⚠️  Keep this secret secure and never commit it to version control!\n')

