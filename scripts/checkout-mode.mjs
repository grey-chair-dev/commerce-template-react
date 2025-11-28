#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const action = process.argv[2]

const validModes = ['delivery', 'pickup', 'both']

if (!validModes.includes(action)) {
  console.error('Usage: node scripts/checkout-mode.mjs <delivery|pickup|both>')
  process.exit(1)
}

const envKey = 'VITE_CHECKOUT_MODE'
const envPath = resolve(process.cwd(), '.env.local')

let envContents = ''
let currentValue = null
let hasKey = false

if (existsSync(envPath)) {
  envContents = readFileSync(envPath, 'utf-8')
  const lines = envContents.split(/\r?\n/)
  for (const line of lines) {
    if (line.startsWith(`${envKey}=`)) {
      hasKey = true
      currentValue = line.split('=')[1]?.trim()
      break
    }
  }
}

// Check if already in desired state
if (hasKey && currentValue === action) {
  console.log(`ℹ️  Checkout mode is already set to "${action}".`)
  process.exit(0)
}

// Add or update the key
const lines = envContents.split(/\r?\n/)
let found = false
const updatedLines = lines.map((line) => {
  if (line.startsWith(`${envKey}=`)) {
    found = true
    return `${envKey}=${action}`
  }
  return line
})

if (!found) {
  updatedLines.push(`${envKey}=${action}`)
}

writeFileSync(envPath, updatedLines.filter(Boolean).join('\n') + '\n')

const modeDescriptions = {
  delivery: 'Delivery only (no pickup option)',
  pickup: 'Pickup only (no delivery option)',
  both: 'Both delivery and pickup available',
}

console.log(`✅ Checkout mode set to "${action}" - ${modeDescriptions[action]}`)

