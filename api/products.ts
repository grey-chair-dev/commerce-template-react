/**
 * Fast Products Read Endpoint
 * 
 * Serves pre-formatted product data from cache (updated via webhooks).
 * This endpoint is fast because it bypasses Square API calls and serves
 * from Neon PostgreSQL cache instead.
 * 
 * Frontend calls: /api/products?appId=spiralgroove
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getCachedProducts } from '../src/services/cacheService.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get appId from query (for future multi-tenant support)
  const appId = (req.query.appId as string) || 'spiralgroove'

  try {
    // Try to get from cache
    const cached = await getCachedProducts(appId)

    if (cached && cached.products) {
      console.log(`[Products API] Serving ${cached.products.length} products from cache (updated: ${cached.timestamp})`)
      
      return res.status(200).json({
        products: cached.products,
        appId,
        timestamp: cached.timestamp,
        cached: true,
      })
    }

    // Cache miss - return empty array
    // In production, you might want to trigger a refresh here
    console.warn('[Products API] Cache miss - no products found in cache')
    
    return res.status(200).json({
      products: [],
      appId,
      timestamp: new Date().toISOString(),
      cached: false,
      message: 'No cached products found. Webhook may not have been triggered yet.',
    })
  } catch (error: any) {
    console.error('[Products API] Error reading from cache:', error)
    return res.status(500).json({
      error: 'Failed to fetch products',
      message: error.message || 'Unknown error',
    })
  }
}


