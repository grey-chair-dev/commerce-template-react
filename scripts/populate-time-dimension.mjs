#!/usr/bin/env node

/**
 * Populate Time Dimension Table
 * 
 * Fills the time_dim table with dates for analytics
 * Typically runs once to populate historical dates, then periodically for future dates
 * 
 * Usage:
 *   npm run etl:populate-time
 *   or
 *   node scripts/populate-time-dimension.mjs [startYear] [endYear]
 */

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load .env.local file
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
  if (error.code !== 'ENOENT') {
    console.warn(`⚠️  Warning: Could not read .env.local: ${error.message}`)
  }
}

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not set')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

// Simple holiday list (can be expanded)
const HOLIDAYS = new Set([
  '2025-01-01', // New Year's Day
  '2025-07-04', // Independence Day
  '2025-12-25', // Christmas
  '2025-11-27', // Thanksgiving
  '2025-12-31', // New Year's Eve
  // Add more holidays as needed
])

function getDayOfWeek(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[date.getDay()]
}

function getQuarter(month) {
  return Math.floor((month - 1) / 3) + 1
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

async function populateTimeDimension(startYear = 2020, endYear = 2030) {
  console.log(`\n📅 Populating Time Dimension (${startYear} - ${endYear})\n`)
  console.log('='.repeat(60))

  try {
    let inserted = 0
    let skipped = 0

    for (let year = startYear; year <= endYear; year++) {
      for (let month = 1; month <= 12; month++) {
        const daysInMonth = new Date(year, month, 0).getDate()

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month - 1, day)
          const dateStr = date.toISOString().split('T')[0]
          const dayOfWeek = getDayOfWeek(date)
          const dayOfWeekNum = date.getDay() === 0 ? 7 : date.getDay() // Monday = 1
          const isWeekend = dayOfWeekNum >= 6
          const isHoliday = HOLIDAYS.has(dateStr)
          const quarter = getQuarter(month)
          const weekNumber = getWeekNumber(date)
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                            'July', 'August', 'September', 'October', 'November', 'December']
          const monthName = monthNames[month - 1]
          const quarterName = `Q${quarter} ${year}`

          try {
            await sql`
              INSERT INTO time_dim (
                date, day, month, quarter, year,
                day_of_week, day_of_week_num, is_weekend, is_holiday,
                week_number, month_name, quarter_name
              )
              VALUES (
                ${dateStr}::date,
                ${day},
                ${month},
                ${quarter},
                ${year},
                ${dayOfWeek},
                ${dayOfWeekNum},
                ${isWeekend},
                ${isHoliday},
                ${weekNumber},
                ${monthName},
                ${quarterName}
              )
              ON CONFLICT (date) DO NOTHING
            `
            inserted++
          } catch (error) {
            if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
              skipped++
            } else {
              throw error
            }
          }
        }
      }
    }

    console.log(`✅ Inserted: ${inserted} dates`)
    console.log(`⏭️  Skipped: ${skipped} dates (already exist)`)
    console.log('\n' + '='.repeat(60))
    console.log('✅ Time dimension populated!\n')

  } catch (error) {
    console.error('\n❌ Error populating time dimension:')
    console.error(error.message)
    
    if (error.message?.includes('does not exist')) {
      console.error('\n💡 The time_dim table might not exist.')
      console.error('   Run the migration: migrations/003_create_star_schema.sql')
    }
    
    process.exit(1)
  }
}

const startYear = parseInt(process.argv[2]) || 2020
const endYear = parseInt(process.argv[3]) || 2030

populateTimeDimension(startYear, endYear)

