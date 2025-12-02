#!/usr/bin/env node

/**
 * Test Square Webhook Endpoint
 * 
 * This script sends a test webhook payload to your webhook endpoint
 * to verify it's working correctly.
 * 
 * Usage:
 *   node scripts/test-webhook.mjs [webhook-url]
 * 
 * Example:
 *   node scripts/test-webhook.mjs http://localhost:3000/api/webhooks/square
 *   node scripts/test-webhook.mjs https://your-app.vercel.app/api/webhooks/square
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createHmac } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    const env = {}
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim()
        }
      }
    })
    
    return env
  } catch (error) {
    console.warn('Could not load .env.local, using process.env')
    return {}
  }
}

const env = loadEnv()

const webhookUrl = process.argv[2] || 'http://localhost:3000/api/webhooks/square'
const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || env.SQUARE_WEBHOOK_SIGNATURE_KEY

// Sample Square webhook payload (catalog.version.updated event)
const testPayload = {
  merchant_id: 'MLY8V8R8Q5QRJ',
  type: 'catalog.version.updated',
  event_id: 'test-event-' + Date.now(),
  created_at: new Date().toISOString(),
  data: {
    type: 'catalog',
    id: 'test-catalog-version',
    object: {
      type: 'CATALOG_VERSION',
      version: Date.now(),
    },
  },
}

const payloadString = JSON.stringify(testPayload)

// Generate signature if key is available
let signature = null
if (signatureKey) {
  const hmac = createHmac('sha256', signatureKey)
  hmac.update(payloadString)
  signature = hmac.digest('base64')
  console.log('✅ Generated webhook signature')
} else {
  console.warn('⚠️  SQUARE_WEBHOOK_SIGNATURE_KEY not found, sending without signature')
}

console.log(`\n📤 Sending test webhook to: ${webhookUrl}`)
console.log(`📦 Event type: ${testPayload.type}`)
console.log(`🔑 Signature: ${signature ? 'Yes' : 'No'}\n`)

try {
  const headers = {
    'Content-Type': 'application/json',
  }
  
  if (signature) {
    headers['x-square-signature'] = signature
  }
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: payloadString,
  })
  
  const responseText = await response.text()
  let responseData
  try {
    responseData = JSON.parse(responseText)
  } catch {
    responseData = responseText
  }
  
  console.log(`📥 Response Status: ${response.status} ${response.statusText}`)
  console.log(`📥 Response Body:`, responseData)
  
  if (response.ok) {
    console.log('\n✅ Webhook test successful!')
  } else {
    console.log('\n❌ Webhook test failed')
    process.exit(1)
  }
} catch (error) {
  console.error('\n❌ Error sending webhook:', error.message)
  if (error.code === 'ECONNREFUSED') {
    console.error('   Make sure the server is running (vercel dev or production)')
  }
  process.exit(1)
}

