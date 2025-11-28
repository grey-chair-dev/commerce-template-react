#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const action = process.argv[2]

if (action !== 'add' && action !== 'delete') {
  console.error('Usage: node scripts/order-tracking-toggle.mjs <add|delete>')
  process.exit(1)
}

const envKey = 'VITE_ENABLE_ORDER_TRACKING'
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

if (action === 'add') {
  // Check if already enabled
  if (hasKey && currentValue === 'true') {
    console.log('ℹ️  Order tracking feature is already enabled.')
    process.exit(0)
  }

  // Add or update the key to true
  const lines = envContents.split(/\r?\n/)
  let found = false
  const updatedLines = lines.map((line) => {
    if (line.startsWith(`${envKey}=`)) {
      found = true
      return `${envKey}=true`
    }
    return line
  })

  if (!found) {
    updatedLines.push(`${envKey}=true`)
  }

  writeFileSync(envPath, updatedLines.filter(Boolean).join('\n') + '\n')
  console.log('✅ Order tracking feature enabled (set to true).')
} else {
  // delete action - set to false
  if (hasKey && currentValue === 'false') {
    console.log('ℹ️  Order tracking feature is already disabled.')
    process.exit(0)
  }

  // Add or update the key to false
  const lines = envContents.split(/\r?\n/)
  let found = false
  const updatedLines = lines.map((line) => {
    if (line.startsWith(`${envKey}=`)) {
      found = true
      return `${envKey}=false`
    }
    return line
  })

  if (!found) {
    updatedLines.push(`${envKey}=false`)
  }

  writeFileSync(envPath, updatedLines.filter(Boolean).join('\n') + '\n')
  console.log('🧹 Order tracking feature disabled (set to false).')
}

