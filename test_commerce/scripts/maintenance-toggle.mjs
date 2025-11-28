#!/usr/bin/env node

/**
 * Toggle script for VITE_ENABLE_MAINTENANCE_PAGE
 * Usage: node scripts/maintenance-toggle.mjs [add|delete]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const envLocalPath = join(process.cwd(), '.env.local')
const varName = 'VITE_ENABLE_MAINTENANCE_PAGE'

const action = process.argv[2] || 'add'

if (action !== 'add' && action !== 'delete') {
  console.error('Usage: node scripts/maintenance-toggle.mjs [add|delete]')
  process.exit(1)
}

let envContent = ''
if (existsSync(envLocalPath)) {
  envContent = readFileSync(envLocalPath, 'utf-8')
}

const targetValue = action === 'add' ? 'true' : 'false'
const regex = new RegExp(`^${varName}=.*$`, 'm')
const hasVar = regex.test(envContent)

if (hasVar) {
  const currentValue = envContent.match(regex)?.[0]?.split('=')[1]?.trim()
  if (currentValue === targetValue) {
    console.log(
      `✓ Maintenance page is already ${action === 'add' ? 'enabled' : 'disabled'}.`,
    )
    process.exit(0)
  }
  envContent = envContent.replace(regex, `${varName}=${targetValue}`)
} else {
  envContent += (envContent && !envContent.endsWith('\n') ? '\n' : '') + `${varName}=${targetValue}\n`
}

writeFileSync(envLocalPath, envContent, 'utf-8')
console.log(
  `✓ Maintenance page ${action === 'add' ? 'enabled' : 'disabled'}. Set ${varName}=${targetValue}`,
)
console.log('  Restart your dev server for changes to take effect.')

