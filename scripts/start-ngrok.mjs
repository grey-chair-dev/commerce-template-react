#!/usr/bin/env node

/**
 * Start ngrok tunnel for local webhook testing
 * 
 * This script starts ngrok to expose your local Vercel dev server
 * so Square can send webhooks to it during development.
 * 
 * Prerequisites:
 *   1. Install ngrok: brew install ngrok (or download from ngrok.com)
 *   2. Sign up for free account: https://dashboard.ngrok.com/signup
 *   3. Get authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
 *   4. Configure: ngrok config add-authtoken YOUR_TOKEN
 * 
 * Usage:
 *   node scripts/start-ngrok.mjs [port]
 * 
 * Default port: 3000 (Vercel dev server)
 * 
 * Example:
 *   node scripts/start-ngrok.mjs
 *   node scripts/start-ngrok.mjs 3000
 * 
 * Then:
 *   1. Copy the ngrok HTTPS URL (e.g., https://xxxx.ngrok.io)
 *   2. Use in Square Dashboard: https://xxxx.ngrok.io/api/webhooks/square
 *   3. Make sure vercel dev is running on port 3000
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const port = process.argv[2] || '3000'

console.log('🚇 Starting ngrok tunnel...')
console.log(`📡 Exposing local port ${port} to the internet`)
console.log('')
console.log('⚠️  Make sure vercel dev is running on port', port)
console.log('')

// Start ngrok
const ngrok = spawn('ngrok', ['http', port], {
  stdio: 'inherit',
  shell: true,
})

ngrok.on('error', (error) => {
  if (error.code === 'ENOENT') {
    console.error('❌ ngrok not found!')
    console.error('')
    console.error('Install ngrok:')
    console.error('  macOS: brew install ngrok')
    console.error('  Or download from: https://ngrok.com/download')
    console.error('')
    console.error('Then sign up and configure:')
    console.error('  1. Sign up: https://dashboard.ngrok.com/signup')
    console.error('  2. Get authtoken: https://dashboard.ngrok.com/get-started/your-authtoken')
    console.error('  3. Configure: ngrok config add-authtoken YOUR_TOKEN')
    process.exit(1)
  } else {
    console.error('❌ Error starting ngrok:', error.message)
    process.exit(1)
  }
})

ngrok.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n❌ ngrok exited with code ${code}`)
    process.exit(code)
  }
})

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping ngrok...')
  ngrok.kill()
  process.exit(0)
})

console.log('✅ ngrok is running!')
console.log('')
console.log('📋 Next steps:')
console.log('  1. Check ngrok web interface: http://localhost:4040')
console.log('  2. Copy the HTTPS URL (e.g., https://xxxx.ngrok.io)')
console.log('  3. Use in Square Dashboard: https://xxxx.ngrok.io/api/webhooks/square')
console.log('  4. Press Ctrl+C to stop ngrok')
console.log('')

