/**
 * Product Detail API Endpoint
 * 
 * GET /api/catalog/[productId]
 * 
 * Returns detailed product information including Discogs enrichment data.
 * 
 * Features:
 * - Fetches core product data from database
 * - Optionally enriches with Discogs data (tracklist, release info)
 * - Implements strict timeout (500ms) for Discogs calls
 * - Gracefully degrades if Discogs API is slow/down
 * - Sends Slack alerts on Discogs failures
 * 
 * Response:
 *   {
 *     "id": "...",
 *     "name": "...",
 *     "description": "...",
 *     "price": 29.99,
 *     "category": "Vinyl Records",
 *     "stock_count": 5,
 *     "image_url": "...",
 *     "rating": 4.5,
 *     "review_count": 12,
 *     "tracklist": [...],  // Only if Discogs enabled and data available
 *     "discogs_release_id": 12345,  // Only if Discogs enabled and data available
 *     "discogs_year": 1975,  // Only if Discogs enabled and data available
 *     "discogs_label": "Atlantic Records"  // Only if Discogs enabled and data available
 *   }
 */

import { neon } from '@neondatabase/serverless'
import { isDiscogsEnabled } from '../utils/featureFlags.js'
import { sendSlackAlert } from '../utils/slackAlerter.js'

// Strict timeout for Discogs API calls (500ms)
const DISCOGS_TIMEOUT_MS = 500

/**
 * Create a timeout promise that rejects after specified milliseconds
 */
function createTimeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms)
  })
}

/**
 * Fetch Discogs data for a product with timeout protection
 * Returns null if timeout, error, or non-200 status
 */
async function fetchDiscogsDataWithTimeout(productId, productName) {
  const userToken = process.env.DISCOGS_USER_TOKEN
  const userAgent = process.env.DISCOGS_USER_AGENT || 'SpiralGroove/1.0'
  const databaseUrl = process.env.DATABASE_URL || process.env.SPR_DATABASE_URL

  if (!userToken || !databaseUrl) {
    return null
  }

  try {
    // Import Discogs adapter functions
    const { getDiscogsRelease, extractTracklist, matchProductToDiscogs } = await import('../../src/services/discogsAdapter.js')
    const sql = neon(databaseUrl)

    // Check if we already have Discogs data in Product_Detail table
    const existingData = await sql`
      SELECT 
        tracklist,
        discogs_release_id,
        discogs_year,
        discogs_label
      FROM "Product_Detail"
      WHERE square_item_id = ${productId}
      LIMIT 1
    `

    // If we have cached data, return it immediately (no API call needed)
    if (existingData && existingData.length > 0 && existingData[0].tracklist) {
      const data = existingData[0]
      return {
        tracklist: typeof data.tracklist === 'string' ? JSON.parse(data.tracklist) : data.tracklist,
        discogs_release_id: data.discogs_release_id,
        discogs_year: data.discogs_year,
        discogs_label: data.discogs_label,
      }
    }

    // No cached data - fetch from Discogs API with timeout
    // Race between Discogs API call and timeout
    const discogsPromise = (async () => {
      // Search for release ID
      const releaseId = await matchProductToDiscogs(productName, {
        userToken,
        userAgent,
      })

      if (!releaseId) {
        return null
      }

      // Fetch release details
      const release = await getDiscogsRelease(releaseId, {
        userToken,
        userAgent,
      })

      const tracklist = extractTracklist(release)

      // Store in database for future requests
      await sql`
        INSERT INTO "Product_Detail" (
          square_item_id,
          tracklist,
          discogs_release_id,
          discogs_year,
          discogs_label,
          discogs_updated_at,
          updated_at
        )
        VALUES (
          ${productId},
          ${JSON.stringify(tracklist)}::jsonb,
          ${releaseId},
          ${release.year || null},
          ${release.labels?.[0]?.name || null},
          NOW(),
          NOW()
        )
        ON CONFLICT (square_item_id)
        DO UPDATE SET
          tracklist = ${JSON.stringify(tracklist)}::jsonb,
          discogs_release_id = ${releaseId},
          discogs_year = ${release.year || null},
          discogs_label = ${release.labels?.[0]?.name || null},
          discogs_updated_at = NOW(),
          updated_at = NOW()
      `

      return {
        tracklist,
        discogs_release_id: releaseId,
        discogs_year: release.year || null,
        discogs_label: release.labels?.[0]?.name || null,
      }
    })()

    // Race between Discogs call and timeout
    const result = await Promise.race([
      discogsPromise,
      createTimeout(DISCOGS_TIMEOUT_MS),
    ])

    return result
  } catch (error) {
    // Timeout or other error - rethrow so caller can send Slack alert
    // The outer try/catch will handle graceful degradation
    throw error
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null,
  ].filter(Boolean)

  // When credentials are included, we must set Access-Control-Allow-Credentials: true
  // and cannot use wildcard (*) for Access-Control-Allow-Origin
  let originToAllow = null
  
  if (origin) {
    // Always allow localhost origins (common in development)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      originToAllow = origin
    } else if (allowedOrigins.includes(origin)) {
      originToAllow = origin
    } else if (allowedOrigins.some(allowed => origin.includes(allowed.split('://')[1]))) {
      originToAllow = origin
    }
  }
  
  // If no origin header or origin not matched, default to localhost:5173 in development
  if (!originToAllow && (process.env.NODE_ENV === 'development' || !process.env.VERCEL)) {
    originToAllow = 'http://localhost:5173'
  }

  // Set CORS headers - always set credentials when we have an origin
  if (originToAllow) {
    res.setHeader('Access-Control-Allow-Origin', originToAllow)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
  res.setHeader('Access-Control-Max-Age', '86400')

  // Handle preflight OPTIONS request
  // IMPORTANT: Must return credentials header in OPTIONS response too
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({
      error: 'Method not allowed',
      message: `This endpoint only accepts GET requests. Received: ${req.method}`,
      allowed_methods: ['GET'],
    })
  }

  try {
    const startTime = Date.now()
    const { productId } = req.query

    if (!productId) {
      return res.status(400).json({
        error: 'Product ID required',
        message: 'Please provide a productId query parameter',
      })
    }

    // Get database URL
    const databaseUrl = process.env.SPR_DATABASE_URL ||
                       process.env.SPR_NEON_DATABSE_URL ||
                       process.env.DATABASE_URL

    if (!databaseUrl) {
      return res.status(500).json({
        error: 'Database not configured',
        message: 'Set SPR_DATABASE_URL in Vercel environment variables',
      })
    }

    const sql = neon(databaseUrl)

    // Fetch core product data
    const productResult = await sql`
      SELECT 
        id,
        name,
        description,
        price,
        category,
        stock_count,
        image_url,
        rating,
        review_count,
        created_at,
        updated_at
      FROM products
      WHERE id = ${productId}
      LIMIT 1
    `

    if (!productResult || productResult.length === 0) {
      return res.status(404).json({
        error: 'Product not found',
        message: `No product found with ID: ${productId}`,
      })
    }

    const product = productResult[0]

    // Category lookup (same as products.js)
    const categoryLookup = {
      'C2JFIAPXRNSMGXUK4FIA2BBX': 'Vinyl Records',
      'WQ5ZX4FB6VERZ2BP3XKPNP3Y': 'Vinyl Records',
      'P6C3ATETEUT5EY6LOIUTP76O': 'Cassettes',
      'LTUTEKGG4STHRELDLO7ADXPF': 'Cassettes',
      'CG5VVZR63475T6DKB73J3JTY': '45 RPM',
      'PUDWH2SQ4T7FAA3AOXHT2KCQ': 'CDs',
      'HOKJNULDLMPUDHKMZBT4XPPD': 'Audio Equipment',
      'IMZGHMKAYYGACBSG56O6I7NA': 'Posters',
      'TP6LVYCAFHIISUK3BDTQX73T': 'Crates',
      'RMFPEQVVLWTRYYU55UN45KNR': 'DVDs',
      '34ODRGEUHNITZDWW6W4E5TE4': 'Books',
      'ZKT567JNEQCCD7ARXL5THCWD': 'Puzzles',
      'ILBV23LCAC4XBTE6NBXGM7LQ': 'Cleaner',
      'BCLLIRRB7TKZ7EZTEJ6L4NXH': 'Sleeves',
      'DVD3K4ZD4SN2FU2CZENSFMEM': 'Vinyl Records',
      'VYPB4CCY4OKQZUCCFRMTYOKY': 'Vinyl Records',
      'MZ33ZZO7M7GDAUIC6DAV477I': 'Vinyl Records',
      'HOZIQSBJEF6I6FTNGH3FSQBA': 'Vinyl Records',
      'IFWW2EEGULRUBRXLD3QZXH2A': 'Vinyl Records',
      '7GXCIRJY6PO4QEA37VWMRBFW': 'Vinyl Records',
      'THI6SD6TCR4IX4FB2YDI5USE': 'Jazz',
      '5RBJRCZGCHBTRM3EQ4V5TCU3': 'Band T-shirts',
      'V5SOIKK6FVGNAX4YJQZGSAMI': 'Misc',
    }

    const getDisplayCategory = (category, productName) => {
      if (!category) {
        if (productName) {
          const nameLower = productName.toLowerCase()
          if (nameLower.includes('cassette')) return 'Cassettes'
          if (nameLower.includes('cd')) return 'CDs'
          if (nameLower.includes('45')) return '45 RPM'
          if (nameLower.includes('33') || nameLower.includes('vinyl') || nameLower.includes('record')) return 'Vinyl Records'
          if (nameLower.includes('turntable') || nameLower.includes('speaker') || nameLower.includes('receiver')) return 'Audio Equipment'
        }
        return 'Uncategorized'
      }
      if (categoryLookup[category]) {
        return categoryLookup[category]
      }
      if (category.length > 20 && /^[A-Z0-9]+$/.test(category)) {
        return 'Vinyl Records'
      }
      return category
    }

    // Build base response with core product data
    const response = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price ? parseFloat(product.price) : null,
      category: getDisplayCategory(product.category, product.name),
      stock_count: product.stock_count || 0,
      in_stock: (product.stock_count || 0) > 0,
      image_url: product.image_url,
      rating: product.rating ? parseFloat(product.rating) : null,
      review_count: product.review_count || 0,
      created_at: product.created_at,
      updated_at: product.updated_at,
    }

    // Fetch Discogs data if feature flag is enabled
    if (isDiscogsEnabled()) {
      try {
        const discogsData = await fetchDiscogsDataWithTimeout(product.id, product.name)

        if (discogsData) {
          // Successfully fetched Discogs data
          response.tracklist = discogsData.tracklist
          response.discogs_release_id = discogsData.discogs_release_id
          response.discogs_year = discogsData.discogs_year
          response.discogs_label = discogsData.discogs_label
        }
        // If discogsData is null, we simply don't include Discogs fields (graceful degradation)
      } catch (error) {
        // Discogs fetch failed - log warning and continue with core data
        const errorMessage = error.message || 'Unknown error'
        const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('Timeout')
        const isNetworkError = errorMessage.includes('ECONNREFUSED') || 
                               errorMessage.includes('ENOTFOUND') ||
                               errorMessage.includes('ETIMEDOUT') ||
                               errorMessage.includes('Failed to fetch')

        // Send Slack alert (medium priority for timeout, low for other errors)
        const priority = isTimeout ? 'medium' : 'low'
        const errorId = `discogs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        await sendSlackAlert({
          priority,
          errorId,
          route: `/api/catalog/${productId}`,
          title: 'Discogs API Request Failed',
          message: isTimeout
            ? `Discogs API request timed out after ${DISCOGS_TIMEOUT_MS}ms for product "${product.name}"`
            : `Discogs API request failed for product "${product.name}"`,
          context: errorMessage,
          recommendedAction: [
            'Check Discogs API status: https://www.discogs.com/developers',
            'Verify DISCOGS_USER_TOKEN is valid',
            'Review rate limiting - may need to increase timeout or implement retry logic',
            'Product page will load with core data only (graceful degradation)',
          ],
          fields: {
            'Product ID': product.id,
            'Product Name': product.name,
            'Error Type': isTimeout ? 'Timeout' : isNetworkError ? 'Network Error' : 'API Error',
            'Timeout (ms)': DISCOGS_TIMEOUT_MS.toString(),
          },
          links: {
            'View Product': `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/catalog/${productId}`,
            'Discogs API Docs': 'https://www.discogs.com/developers',
          },
        }).catch(slackError => {
          // Don't fail the request if Slack alert fails
          console.error('[Product Detail] Failed to send Slack alert:', slackError)
        })

        // Log warning (but don't throw - graceful degradation)
        console.warn(`[Product Detail] Discogs fetch failed for product ${product.id}:`, errorMessage)
      }
    }

    // Calculate performance metrics
    const endTime = Date.now()
    const duration = endTime - startTime

    if (duration > 300) {
      console.warn(`[Performance] Product detail API response took ${duration}ms (target: <300ms)`)
    } else {
      console.log(`[Performance] Product detail API response: ${duration}ms ✅`)
    }

    // Set cache headers
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600, max-age=300')
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('X-Response-Time', `${duration}ms`)

    return res.status(200).json(response)
  } catch (error) {
    console.error('[Product Detail] Error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
}
