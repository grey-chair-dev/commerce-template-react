#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const action = process.argv[2]

if (action !== 'add' && action !== 'delete') {
  console.error('Usage: node scripts/mock-data.mjs <add|delete>')
  process.exit(1)
}

const envPath = resolve(process.cwd(), '.env.local')
const envKey = 'VITE_ENABLE_MOCK_DATA'

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
    console.log('ℹ️  Mock data is already enabled.')
    process.exit(0)
  }

  // Add or update the key
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

  const sanitized = updatedLines.filter((line, index, arr) => {
    if (index === arr.length - 1 && line.trim() === '') {
      return false
    }
    return true
  })

  writeFileSync(envPath, sanitized.join('\n') + '\n')
  console.log('✅ Mock data enabled. The dev server will fall back to the local feed.')
} else {
  // delete action
  if (!hasKey) {
    console.log('ℹ️  Mock data is already deleted (not in .env.local).')
    process.exit(0)
  }

  // Remove the line entirely
  const lines = envContents.split(/\r?\n/)
  const updatedLines = lines.filter((line) => !line.startsWith(`${envKey}=`))

  const sanitized = updatedLines.filter((line, index, arr) => {
    if (index === arr.length - 1 && line.trim() === '') {
      return false
    }
    return true
  })

  writeFileSync(envPath, sanitized.join('\n') + '\n')
  console.log('🧹 Mock data deleted (removed from .env.local). Provide a real-time adapter URL before running the app.')
}

