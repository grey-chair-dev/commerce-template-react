/**
 * Cache Warm-up Endpoint
 * 
 * Manually triggers a cache refresh. Useful for:
 * - Initial setup before webhooks are configured
 * - Manual refresh if webhook fails
 * - Testing the cache system
 * 
 * Call: POST /api/warm-cache
 * Or: GET /api/warm-cache (for easy browser testing)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCachedProducts } from '../src/services/cacheService.js'
import { fetchSquareProducts, type SquareConfig } from '../src/services/squareAdapter.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow both GET and POST for flexibility
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check DATABASE_URL first
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      error: 'DATABASE_URL not configured',
      message: 'Please set DATABASE_URL in Vercel environment variables',
    })
  }

  const accessToken = process.env.SQUARE_ACCESS_TOKEN
  const environment = (process.env.SQUARE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'
  // Trim whitespace/newlines from locationId (common issue with .env files)
  const locationId = process.env.SQUARE_LOCATION_ID?.trim()

  if (!accessToken || !locationId) {
    return res.status(500).json({
      error: 'Square credentials not configured',
      message: 'Please set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID',
    })
  }

  try {
    const config: SquareConfig = {
      accessToken,
      environment,
      locationId,
    }

    console.log('[Warm Cache] Fetching products from Square...')
    const products = await fetchSquareProducts(config)
    
    console.log(`[Warm Cache] Caching ${products.length} products`)
    
    // Cache the products in Neon database
    await setCachedProducts(products, 'spiralgroove')
    
    console.log('[Warm Cache] Cache warmed successfully')
    
    return res.status(200).json({
      success: true,
      message: 'Cache warmed successfully',
      productCount: products.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Warm Cache] Error:', error)
    console.error('[Warm Cache] Error stack:', error.stack)
    console.error('[Warm Cache] DATABASE_URL set:', !!process.env.DATABASE_URL)
    
    // Provide more detailed error information
    let errorMessage = error.message || 'Unknown error'
    if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
      errorMessage = 'product_cache table does not exist. Please create it first. See QUICK_SETUP_CACHE.md'
    } else if (error.message?.includes('DATABASE_URL')) {
      errorMessage = 'DATABASE_URL not set. Make sure it\'s in .env.local and restart vercel dev'
    }
    
    return res.status(500).json({
      error: 'Failed to warm cache',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}


